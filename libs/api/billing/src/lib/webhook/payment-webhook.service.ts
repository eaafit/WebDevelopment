import { create } from '@bufbuild/protobuf';
import {
  ProcessWebhookResponseSchema,
  type ProcessWebhookRequest,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { MetricsService } from '@internal/metrics';
import {
  PaymentStatus as PrismaPaymentStatus,
  PaymentType as PrismaPaymentType,
  type Prisma,
} from '@internal/prisma-client';
import { timingSafeEqual } from 'node:crypto';
import { PaymentSubscriptionService } from '../subscription/payment-subscription.service';
import { YooKassaClient } from '../yookassa/yookassa.client';

export interface YooKassaNotificationPayload {
  type: string;
  event: string;
  object: {
    id?: string;
    status?: string;
    metadata?: Record<string, string>;
    [key: string]: unknown;
  };
}

export interface PaymentWebhookContext {
  signature?: string;
}

export class PaymentWebhookError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'PaymentWebhookError';
  }
}

type PaymentRecord = Prisma.PaymentGetPayload<{
  select: {
    id: true;
    userId: true;
    amount: true;
    status: true;
    type: true;
    promoId: true;
    subscriptionId: true;
    paymentMethod: true;
    transactionId: true;
  };
}>;

@Injectable()
export class PaymentWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly yookassa: YooKassaClient,
    private readonly paymentSubscriptionService: PaymentSubscriptionService,
  ) {}

  async processWebhook(request: ProcessWebhookRequest) {
    const body = parseWebhookPayload(request.payload);
    await this.handleYooKassaNotification(body, { signature: request.signature });
    return create(ProcessWebhookResponseSchema, { success: true });
  }

  async handleYooKassaNotification(
    body: unknown,
    context: PaymentWebhookContext = {},
  ): Promise<void> {
    const payload =
      typeof body === 'string'
        ? parseWebhookPayload(body)
        : isYooKassaNotificationPayload(body)
          ? body
          : parseWebhookPayload(JSON.stringify(body));

    if (payload.type !== 'notification' || !payload.object.id) {
      return;
    }

    this.assertWebhookSecret(context.signature);

    const providerPayment = await this.yookassa.getPayment(payload.object.id);
    if (
      providerPayment.id !== payload.object.id ||
      providerPayment.status !== payload.object.status
    ) {
      throw new PaymentWebhookError('Webhook payload could not be verified', 401);
    }

    const internalPaymentId = providerPayment.metadata['payment_id'];
    const payment = await this.findPayment(payload.object.id, internalPaymentId);
    if (!payment) {
      return;
    }

    if (internalPaymentId && internalPaymentId !== payment.id) {
      throw new PaymentWebhookError('Webhook payload payment metadata mismatch', 401);
    }

    if (
      parseMoneyToCents(payment.amount.toString()) !==
      parseMoneyToCents(providerPayment.amountValue)
    ) {
      throw new PaymentWebhookError('Webhook payload amount mismatch', 401);
    }

    switch (payload.event) {
      case 'payment.succeeded':
        await this.handlePaymentSucceeded(payment, providerPayment.paymentMethodType);
        return;

      case 'payment.canceled':
        await this.handlePaymentCanceled(payment, providerPayment.paymentMethodType);
        return;

      default:
        return;
    }
  }

  private async handlePaymentSucceeded(
    payment: PaymentRecord,
    paymentMethodType: string | null,
  ): Promise<void> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: PrismaPaymentStatus.Pending,
        },
        data: {
          status: PrismaPaymentStatus.Completed,
          paymentMethod: paymentMethodType ?? payment.paymentMethod ?? 'yookassa_widget',
        },
      });

      if (result.count === 0) {
        return false;
      }

      if (payment.type === PrismaPaymentType.Subscription && payment.subscriptionId) {
        await this.paymentSubscriptionService.activateSubscription(tx, payment.subscriptionId);
      }

      if (payment.promoId) {
        await tx.promo.update({
          where: { id: payment.promoId },
          data: {
            usedCount: {
              increment: 1,
            },
          },
        });
      }

      return true;
    });

    if (!updated) {
      return;
    }

    this.metrics.recordPayment('completed');
    this.metrics.recordPaymentAmount(Number(payment.amount));
  }

  private async handlePaymentCanceled(
    payment: PaymentRecord,
    paymentMethodType: string | null,
  ): Promise<void> {
    const result = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: PrismaPaymentStatus.Pending,
      },
      data: {
        status: PrismaPaymentStatus.Failed,
        paymentMethod: paymentMethodType ?? payment.paymentMethod ?? 'yookassa_widget',
      },
    });

    if (result.count === 0) {
      return;
    }

    this.metrics.recordPayment('failed');
  }

  private async findPayment(
    externalPaymentId: string,
    internalPaymentId?: string,
  ): Promise<PaymentRecord | null> {
    return this.prisma.payment.findFirst({
      where: {
        OR: [
          { transactionId: externalPaymentId },
          ...(internalPaymentId ? [{ id: internalPaymentId }] : []),
        ],
      },
      select: {
        id: true,
        userId: true,
        amount: true,
        status: true,
        type: true,
        promoId: true,
        subscriptionId: true,
        paymentMethod: true,
        transactionId: true,
      },
    });
  }

  private assertWebhookSecret(signature?: string): void {
    const expectedSecret = process.env['PAYMENT_WEBHOOK_SECRET']?.trim();
    if (!expectedSecret) {
      return;
    }

    const actualSecret = signature?.trim() ?? '';
    if (!actualSecret) {
      throw new PaymentWebhookError('Webhook secret is missing', 401);
    }

    const expectedBuffer = Buffer.from(expectedSecret);
    const actualBuffer = Buffer.from(actualSecret);
    if (
      expectedBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw new PaymentWebhookError('Webhook secret is invalid', 401);
    }
  }
}

function parseWebhookPayload(payload: string): YooKassaNotificationPayload {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!isYooKassaNotificationPayload(parsed)) {
      throw new Error('Unsupported payload');
    }
    return parsed;
  } catch {
    throw new PaymentWebhookError('Webhook payload is invalid JSON', 400);
  }
}

function isYooKassaNotificationPayload(value: unknown): value is YooKassaNotificationPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as YooKassaNotificationPayload).type === 'string' &&
    typeof (value as YooKassaNotificationPayload).event === 'string' &&
    typeof (value as YooKassaNotificationPayload).object === 'object' &&
    (value as YooKassaNotificationPayload).object !== null
  );
}

function parseMoneyToCents(value: string): number {
  return Math.round(Number(value) * 100);
}
