import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  CreatePaymentResponseSchema,
  PaymentType as RpcPaymentType,
  type CreatePaymentRequest,
  type CreatePaymentResponse,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { MetricsService } from '@internal/metrics';
import {
  PaymentStatus as PrismaPaymentStatus,
  PaymentType as PrismaPaymentType,
  type Promo,
} from '@internal/prisma-client';
import { YooKassaClient, YooKassaClientError } from '../yookassa/yookassa.client';
import {
  SUBSCRIPTION_CURRENCY,
  getSubscriptionPlanByPrisma,
} from '../subscription/subscription-plan.catalog';
import { PaymentSubscriptionService } from '../subscription/payment-subscription.service';

const PAYMENT_RETURN_PATH_BY_TYPE: Record<PrismaPaymentType, string> = {
  [PrismaPaymentType.Subscription]: '/notary/subscription/checkout/success',
  [PrismaPaymentType.Assessment]: '/applicant/checkout/success',
  [PrismaPaymentType.DocumentCopy]: '/applicant/checkout/success',
};

interface ResolvedPaymentContext {
  amount: string;
  description: string;
  subscriptionId: string | null;
  assessmentId: string | null;
  promo: Promo | null;
  discountAmount: string | null;
}

@Injectable()
export class PaymentCreateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly yookassa: YooKassaClient,
    private readonly metrics: MetricsService,
    private readonly paymentSubscriptionService: PaymentSubscriptionService,
  ) {}

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const requestAmount = parseAmountToCents(request.amount, 'amount');
    const prismaType = this.toPrismaType(request.type);
    this.assertReturnUrlConfigured();
    const resolved = await this.resolvePaymentContext(request, prismaType, requestAmount);

    const payment = await this.prisma.payment.create({
      data: {
        userId: request.userId,
        type: prismaType,
        amount: resolved.amount,
        discountAmount: resolved.discountAmount,
        promoId: resolved.promo?.id ?? null,
        status: PrismaPaymentStatus.Pending,
        subscriptionId: resolved.subscriptionId,
        assessmentId: resolved.assessmentId,
        paymentMethod: 'yookassa_widget',
      },
    });

    const returnUrl = this.buildReturnUrl(prismaType, payment.id);
    this.metrics.recordPayment('pending');

    try {
      const result = await this.yookassa.createPayment({
        amount: resolved.amount,
        currency: SUBSCRIPTION_CURRENCY,
        returnUrl,
        description: resolved.description,
        idempotenceKey: payment.id,
        confirmationType: 'embedded',
        metadata: {
          payment_id: payment.id,
          user_id: request.userId,
          type: String(request.type),
          target_id: request.targetId,
          ...(resolved.promo ? { promo_code: resolved.promo.code } : {}),
        },
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { transactionId: result.id },
      });

      return create(CreatePaymentResponseSchema, {
        paymentId: payment.id,
        paymentUrl: result.confirmationUrl || undefined,
        widget: {
          provider: 'yookassa',
          confirmationToken: result.confirmationToken,
          returnUrl,
        },
        amount: {
          amount: resolved.amount,
          currency: SUBSCRIPTION_CURRENCY,
        },
      });
    } catch (err) {
      if (err instanceof YooKassaClientError) {
        this.metrics.recordPayment('failed');
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PrismaPaymentStatus.Failed },
        });
        throw new ConnectError(err.message || 'Payment provider error', Code.Internal);
      }
      throw err;
    }
  }

  private async resolvePaymentContext(
    request: CreatePaymentRequest,
    prismaType: PrismaPaymentType,
    requestAmountCents: number,
  ): Promise<ResolvedPaymentContext> {
    const promo = await this.findPromo(request.promoCode);

    switch (prismaType) {
      case PrismaPaymentType.Subscription: {
        const subscription = await this.paymentSubscriptionService.resolveSubscriptionForPayment(
          request.targetId,
          request.userId,
        );
        const plan = getSubscriptionPlanByPrisma(subscription.plan);
        const baseAmount = parseAmountToCents(
          subscription.basePrice?.toString() ?? plan.price,
          'subscription.basePrice',
        );
        const discountAmount = promo
          ? calculateDiscountAmount(baseAmount, promo.discountPercent.toString())
          : 0;
        const finalAmount = Math.max(0, baseAmount - discountAmount);

        if (requestAmountCents < 1) {
          throw new ConnectError('amount must be a positive number', Code.InvalidArgument);
        }

        return {
          amount: centsToAmount(finalAmount),
          description: `Подписка ${plan.title}`,
          subscriptionId: subscription.id,
          assessmentId: null,
          promo,
          discountAmount: discountAmount > 0 ? centsToAmount(discountAmount) : null,
        };
      }

      case PrismaPaymentType.Assessment:
        return {
          amount: centsToAmount(requestAmountCents),
          description: 'Оплата оценки имущества',
          subscriptionId: null,
          assessmentId: request.targetId,
          promo: null,
          discountAmount: null,
        };

      case PrismaPaymentType.DocumentCopy:
        return {
          amount: centsToAmount(requestAmountCents),
          description: 'Оплата копии нотариального документа',
          subscriptionId: null,
          assessmentId: null,
          promo: null,
          discountAmount: null,
        };
    }
  }

  private async findPromo(rawPromoCode: string): Promise<Promo | null> {
    const promoCode = rawPromoCode.trim();
    if (!promoCode) {
      return null;
    }

    const promo = await this.prisma.promo.findFirst({
      where: {
        code: {
          equals: promoCode,
          mode: 'insensitive',
        },
      },
    });

    if (!promo) {
      throw new ConnectError('Promo code was not found', Code.InvalidArgument);
    }

    if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
      throw new ConnectError('Promo code has expired', Code.InvalidArgument);
    }

    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      throw new ConnectError('Promo code usage limit has been reached', Code.InvalidArgument);
    }

    return promo;
  }

  private buildReturnUrl(type: PrismaPaymentType, paymentId: string): string {
    const path = PAYMENT_RETURN_PATH_BY_TYPE[type];
    const returnUrl = new URL(path, getPaymentReturnUrlBase());
    returnUrl.searchParams.set('paymentId', paymentId);
    return returnUrl.toString();
  }

  private assertReturnUrlConfigured(): void {
    if (getPaymentReturnUrlBase()) {
      return;
    }

    throw new ConnectError(
      'Payment return URL is not configured: set PAYMENT_RETURN_URL_BASE or FRONTEND_URL',
      Code.Internal,
    );
  }

  private toPrismaType(type: RpcPaymentType): PrismaPaymentType {
    switch (type) {
      case RpcPaymentType.SUBSCRIPTION:
        return PrismaPaymentType.Subscription;
      case RpcPaymentType.ASSESSMENT:
        return PrismaPaymentType.Assessment;
      case RpcPaymentType.DOCUMENT_COPY:
        return PrismaPaymentType.DocumentCopy;
      case RpcPaymentType.UNSPECIFIED:
        throw new ConnectError('payment type is required', Code.InvalidArgument);
    }
    throw new ConnectError(`Unsupported payment type: ${type}`, Code.InvalidArgument);
  }
}

function parseAmountToCents(value: string, fieldName: string): number {
  const normalized = value.trim();
  const amount = Number(normalized);
  if (!normalized || Number.isNaN(amount) || amount <= 0) {
    throw new ConnectError(`${fieldName} must be a positive number`, Code.InvalidArgument);
  }
  return Math.round(amount * 100);
}

function centsToAmount(value: number): string {
  return (value / 100).toFixed(2);
}

function calculateDiscountAmount(baseAmountCents: number, percent: string): number {
  const discountPercent = Number(percent);
  if (Number.isNaN(discountPercent) || discountPercent <= 0) {
    return 0;
  }

  return Math.round(baseAmountCents * (discountPercent / 100));
}

function getPaymentReturnUrlBase(): string {
  return (process.env['PAYMENT_RETURN_URL_BASE'] ?? process.env['FRONTEND_URL'] ?? '').trim();
}
