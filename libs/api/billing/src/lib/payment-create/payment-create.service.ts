import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  CreatePaymentResponseSchema,
  PromoValidationStatus,
  PaymentType as RpcPaymentType,
  SubscriptionPlan as RpcSubscriptionPlan,
  ValidateSubscriptionPromoResponseSchema,
  type CreatePaymentRequest,
  type CreatePaymentResponse,
  type ValidateSubscriptionPromoRequest,
  type ValidateSubscriptionPromoResponse,
} from '@notary-portal/api-contracts';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { MetricsService } from '@internal/metrics';
import {
  PaymentReceiptStatus as PrismaPaymentReceiptStatus,
  PaymentStatus as PrismaPaymentStatus,
  SubscriptionPlan as PrismaSubscriptionPlan,
  PaymentType as PrismaPaymentType,
  type Promo,
} from '@internal/prisma-client';
import {
  YooKassaClient,
  YooKassaClientError,
  type YooKassaReceipt,
} from '../yookassa/yookassa.client';
import {
  SUBSCRIPTION_CURRENCY,
  getSubscriptionPlanByPrisma,
} from '../subscription/subscription-plan.catalog';
import { PaymentSubscriptionService } from '../subscription/payment-subscription.service';
import { resolveBillingPaymentMetricContext } from '../payment-metrics';

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

interface PromoValidationResult {
  promo: Promo | null;
  promoCode: string;
  status: PromoValidationStatus;
}

@Injectable()
export class PaymentCreateService {
  private readonly logger = new Logger(PaymentCreateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yookassa: YooKassaClient,
    private readonly metrics: MetricsService,
    private readonly paymentSubscriptionService: PaymentSubscriptionService,
  ) {}

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const requestAmount = parseAmountToCents(request.amount, 'amount');
    const prismaType = this.toPrismaType(request.type);
    const metricContext = resolveBillingPaymentMetricContext(prismaType);
    this.assertReturnUrlConfigured();
    const resolved = await this.resolvePaymentContext(request, prismaType, requestAmount);
    const receipt =
      prismaType === PrismaPaymentType.Subscription
        ? await this.buildSubscriptionReceipt(request.userId, resolved)
        : undefined;

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
        receiptStatus:
          prismaType === PrismaPaymentType.Subscription ? PrismaPaymentReceiptStatus.Pending : null,
      },
    });

    const returnUrl = this.buildReturnUrl(prismaType, payment.id);
    this.metrics.recordPayment('pending');
    this.metrics.recordBillingPayment('pending', metricContext);

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
        ...(receipt ? { receipt } : {}),
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { transactionId: result.id },
      });

      this.logger.log(
        `Created YooKassa payment ${result.id} for local payment ${payment.id} with receipt data`,
      );

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
        this.metrics.recordBillingPayment('failed', metricContext);
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PrismaPaymentStatus.Failed },
        });
        throw new ConnectError(err.message || 'Payment provider error', Code.Internal);
      }
      throw err;
    }
  }

  async validateSubscriptionPromo(
    request: ValidateSubscriptionPromoRequest,
  ): Promise<ValidateSubscriptionPromoResponse> {
    const plan = getSubscriptionPlanByPrisma(this.toPrismaPlan(request.plan));
    const baseAmountCents = parseAmountToCents(plan.price, 'plan.price');
    const promoValidation = await this.validatePromoCode(request.promoCode);

    if (promoValidation.status !== PromoValidationStatus.VALID || !promoValidation.promo) {
      return create(ValidateSubscriptionPromoResponseSchema, {
        status: promoValidation.status,
        promoCode: promoValidation.promoCode,
        baseAmount: {
          amount: plan.price,
          currency: SUBSCRIPTION_CURRENCY,
        },
        finalAmount: {
          amount: plan.price,
          currency: SUBSCRIPTION_CURRENCY,
        },
        discountAmount: {
          amount: centsToAmount(0),
          currency: SUBSCRIPTION_CURRENCY,
        },
        discountPercent: '0.00',
      });
    }

    const discountAmount = calculateDiscountAmount(
      baseAmountCents,
      promoValidation.promo.discountPercent.toString(),
    );
    const finalAmount = Math.max(0, baseAmountCents - discountAmount);

    return create(ValidateSubscriptionPromoResponseSchema, {
      status: PromoValidationStatus.VALID,
      promoCode: promoValidation.promo.code,
      baseAmount: {
        amount: plan.price,
        currency: SUBSCRIPTION_CURRENCY,
      },
      finalAmount: {
        amount: centsToAmount(finalAmount),
        currency: SUBSCRIPTION_CURRENCY,
      },
      discountAmount: {
        amount: centsToAmount(discountAmount),
        currency: SUBSCRIPTION_CURRENCY,
      },
      discountPercent: promoValidation.promo.discountPercent.toString(),
    });
  }

  private async loadReceiptCustomer(userId: string): Promise<{ email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
      },
    });

    if (!user?.email?.trim()) {
      throw new ConnectError(
        'User email is required to create receipt data',
        Code.FailedPrecondition,
      );
    }

    return {
      email: user.email.trim(),
    };
  }

  private async buildSubscriptionReceipt(
    userId: string,
    resolved: Pick<ResolvedPaymentContext, 'amount' | 'description'>,
  ): Promise<YooKassaReceipt> {
    const receiptCustomer = await this.loadReceiptCustomer(userId);

    return {
      customer: {
        email: receiptCustomer.email,
      },
      items: [
        {
          description: resolved.description,
          quantity: '1.000',
          amount: {
            value: resolved.amount,
            currency: SUBSCRIPTION_CURRENCY,
          },
          vatCode: resolveReceiptVatCode(),
          paymentMode: 'full_prepayment',
          paymentSubject: 'service',
        },
      ],
      internet: true,
    };
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

    const validation = await this.validatePromoCode(rawPromoCode);
    if (validation.status === PromoValidationStatus.VALID) {
      return validation.promo;
    }

    switch (validation.status) {
      case PromoValidationStatus.NOT_FOUND:
        throw new ConnectError('Promo code was not found', Code.InvalidArgument);
      case PromoValidationStatus.EXPIRED:
        throw new ConnectError('Promo code has expired', Code.InvalidArgument);
      case PromoValidationStatus.USAGE_LIMIT_REACHED:
        throw new ConnectError('Promo code usage limit has been reached', Code.InvalidArgument);
      case PromoValidationStatus.UNSPECIFIED:
      default:
        throw new ConnectError('Promo code is invalid', Code.InvalidArgument);
    }
  }

  private async validatePromoCode(rawPromoCode: string): Promise<PromoValidationResult> {
    const promoCode = rawPromoCode.trim();
    if (!promoCode) {
      return {
        promo: null,
        promoCode,
        status: PromoValidationStatus.UNSPECIFIED,
      };
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
      return {
        promo: null,
        promoCode,
        status: PromoValidationStatus.NOT_FOUND,
      };
    }

    if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
      return {
        promo: null,
        promoCode,
        status: PromoValidationStatus.EXPIRED,
      };
    }

    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      return {
        promo: null,
        promoCode,
        status: PromoValidationStatus.USAGE_LIMIT_REACHED,
      };
    }

    return {
      promo,
      promoCode: promo.code,
      status: PromoValidationStatus.VALID,
    };
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

  private toPrismaPlan(plan: RpcSubscriptionPlan): PrismaSubscriptionPlan {
    switch (plan) {
      case RpcSubscriptionPlan.BASIC:
        return PrismaSubscriptionPlan.Basic;
      case RpcSubscriptionPlan.PREMIUM:
        return PrismaSubscriptionPlan.Premium;
      case RpcSubscriptionPlan.ENTERPRISE:
        return PrismaSubscriptionPlan.Enterprise;
      default:
        throw new ConnectError('subscription plan is required', Code.InvalidArgument);
    }
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

function resolveReceiptVatCode(): number {
  const rawValue = process.env['YOOKASSA_RECEIPT_VAT_CODE']?.trim();
  if (!rawValue) {
    throw new ConnectError(
      'YOOKASSA_RECEIPT_VAT_CODE must be configured for subscription receipts',
      Code.FailedPrecondition,
    );
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > 12) {
    throw new ConnectError(
      'YOOKASSA_RECEIPT_VAT_CODE must be an integer from 1 to 12',
      Code.FailedPrecondition,
    );
  }

  return value;
}
