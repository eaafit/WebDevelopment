import { create } from '@bufbuild/protobuf';
import {
  ProcessWebhookResponseSchema,
  type ProcessWebhookRequest,
} from '@notary-portal/api-contracts';
import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '@internal/audit';
import { PrismaService } from '@internal/prisma';
import { MetricsService } from '@internal/metrics';
import {
  PaymentReceiptStatus as PrismaPaymentReceiptStatus,
  PaymentStatus as PrismaPaymentStatus,
  PaymentType as PrismaPaymentType,
  type Prisma,
} from '@internal/prisma-client';
import { timingSafeEqual } from 'node:crypto';
import { PaymentAttachmentService } from '../payment-attachment/payment-attachment.service';
import { resolveBillingPaymentMetricContext } from '../payment-metrics';
import { buildPaymentAuditSnapshot, buildPaymentAuditTarget } from '../payment-audit';
import { PaymentNotificationService } from '../payment-notification.service';
import { RobokassaClient } from '../robokassa/robokassa.client';
import {
  toProviderPaymentDetails,
  toRobokassaProviderPaymentDetails,
} from '../payment-receipt/payment-receipt.renderer';
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

function parseRobokassaResultPayload(value: unknown): RobokassaResultPayload {
  const source =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const outSum = asNonEmptyString(source['OutSum'] ?? source['outSum']);
  const invoiceId = asNonEmptyString(source['InvId'] ?? source['invoiceId']);
  const signatureValue = asNonEmptyString(
    source['SignatureValue'] ?? source['signatureValue'] ?? source['signature'],
  );

  if (!outSum || !invoiceId || !signatureValue) {
    throw new PaymentWebhookError('Robokassa payload is invalid', 400);
  }

  return {
    outSum,
    invoiceId,
    signatureValue,
  };
}

export interface PaymentWebhookContext {
  signature?: string;
}

interface RobokassaResultPayload {
  outSum: string;
  invoiceId: string;
  signatureValue: string;
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
    discountAmount: true;
    subscriptionId: true;
    assessmentId: true;
    paymentMethod: true;
    transactionId: true;
    attachmentFileUrl: true;
    receiptStatus: true;
  };
}>;

@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly yookassa: YooKassaClient,
    private readonly robokassa: RobokassaClient,
    private readonly paymentSubscriptionService: PaymentSubscriptionService,
    private readonly paymentAttachmentService: PaymentAttachmentService,
    private readonly auditService: AuditService,
    private readonly paymentNotificationService: PaymentNotificationService,
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
        await this.handlePaymentSucceeded(payment, providerPayment);
        return;

      case 'payment.canceled':
        await this.handlePaymentCanceled(payment, providerPayment);
        return;

      default:
        return;
    }
  }

  async handleRobokassaResult(body: unknown): Promise<string> {
    const payload = parseRobokassaResultPayload(body);
    const normalizedOutSum = payload.outSum.replace(',', '.');

    const signatureValid = this.robokassa.verifyResultSignature({
      outSum: normalizedOutSum,
      invoiceId: payload.invoiceId,
      signatureValue: payload.signatureValue,
    });

    const payment = await this.findPaymentById(payload.invoiceId);

    if (!signatureValid) {
      if (payment) {
        await this.recordRobokassaCallbackFailure(
          payment,
          { ...payload, outSum: normalizedOutSum },
          'Robokassa signature is invalid',
          401,
        );
      }

      throw new PaymentWebhookError('Robokassa signature is invalid', 401);
    }

    if (!payment) {
      return `OK${payload.invoiceId}`;
    }

    if (parseMoneyToCents(payment.amount.toString()) !== parseMoneyToCents(normalizedOutSum)) {
      await this.recordRobokassaCallbackFailure(
        payment,
        { ...payload, outSum: normalizedOutSum },
        'Robokassa amount mismatch',
        401,
      );

      throw new PaymentWebhookError('Robokassa amount mismatch', 401);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: PrismaPaymentStatus.Pending,
        },
        data: {
          status: PrismaPaymentStatus.Completed,
          paymentMethod: payment.paymentMethod ?? 'robokassa_redirect',
        },
      });

      if (result.count === 0) {
        return false;
      }

      await this.runCompletedPaymentHooks(tx, payment);

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
      return `OK${payload.invoiceId}`;
    }

    this.metrics.recordPayment('completed');
    this.metrics.recordPaymentAmount(Number(payment.amount));
    const metricContext = resolveBillingPaymentMetricContext(payment.type);
    this.metrics.recordBillingPayment('completed', metricContext);
    this.metrics.recordBillingPaymentAmount(Number(payment.amount), metricContext);

    if (payment.promoId) {
      this.metrics.recordPromoApplied(metricContext, 'percent', Number(payment.discountAmount ?? 0));
    }

    await this.recordPaymentStatusAudit(
      payment,
      'payment.completed',
      PrismaPaymentStatus.Completed,
      {
        paymentMethod: payment.paymentMethod ?? 'robokassa_redirect',
        paymentProvider: 'Robokassa',
      },
      'Статус обновлён по Robokassa callback',
    );
    await this.paymentNotificationService.notifyPaymentCompleted({
      ...payment,
      status: PrismaPaymentStatus.Completed,
      paymentMethod: payment.paymentMethod ?? 'robokassa_redirect',
    });

    const shouldStoreReceipt =
      payment.receiptStatus !== PrismaPaymentReceiptStatus.Available ||
      !payment.attachmentFileUrl;

    if (shouldStoreReceipt) {
      try {
        await this.paymentAttachmentService.storeGeneratedReceipt(
          payment.id,
          toRobokassaProviderPaymentDetails(normalizedOutSum, payload.invoiceId),
        );
        this.logger.log(`Stored receipt copy for payment ${payment.id}; provider=Robokassa`);
      } catch (error) {
        this.logger.error(
          `Failed to store receipt copy for payment ${payment.id}`,
          error instanceof Error ? error.stack : undefined,
        );
        await this.paymentAttachmentService.markReceiptFailed(payment.id);
      }
    }

    return `OK${payload.invoiceId}`;
  }

  private async handlePaymentSucceeded(
    payment: PaymentRecord,
    providerPayment: Awaited<ReturnType<YooKassaClient['getPayment']>>,
  ): Promise<void> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: PrismaPaymentStatus.Pending,
        },
        data: {
          status: PrismaPaymentStatus.Completed,
          paymentMethod:
            providerPayment.paymentMethodType ?? payment.paymentMethod ?? 'yookassa_widget',
        },
      });

      if (result.count === 0) {
        return false;
      }

      await this.runCompletedPaymentHooks(tx, payment);

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

    const shouldStoreReceipt =
      updated ||
      payment.receiptStatus !== PrismaPaymentReceiptStatus.Available ||
      !payment.attachmentFileUrl;

    if (shouldStoreReceipt) {
      try {
        await this.paymentAttachmentService.storeGeneratedReceipt(
          payment.id,
          toProviderPaymentDetails(providerPayment),
        );
        this.logger.log(
          `Stored receipt copy for payment ${payment.id}; YooKassa receipt status=${providerPayment.receiptRegistration ?? 'unknown'}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to store receipt copy for payment ${payment.id}`,
          error instanceof Error ? error.stack : undefined,
        );
        await this.paymentAttachmentService.markReceiptFailed(payment.id);
      }
    }

    if (!updated) {
      return;
    }

    this.metrics.recordPayment('completed');
    this.metrics.recordPaymentAmount(Number(payment.amount));
    const metricContext = resolveBillingPaymentMetricContext(payment.type);
    this.metrics.recordBillingPayment('completed', metricContext);
    this.metrics.recordBillingPaymentAmount(Number(payment.amount), metricContext);

    if (payment.promoId) {
      this.metrics.recordPromoApplied(
        metricContext,
        'percent',
        Number(payment.discountAmount ?? 0),
      );
    }
    await this.recordPaymentStatusAudit(
      payment,
      'payment.completed',
      PrismaPaymentStatus.Completed,
      {
        paymentMethod:
          providerPayment.paymentMethodType ?? payment.paymentMethod ?? 'yookassa_widget',
        paymentProvider: 'YooKassa',
        paymentMethodTitle: providerPayment.paymentMethodTitle,
        receiptRegistration: providerPayment.receiptRegistration,
      },
      'Статус обновлён по YooKassa webhook',
    );
    await this.paymentNotificationService.notifyPaymentCompleted({
      ...payment,
      status: PrismaPaymentStatus.Completed,
      paymentMethod:
        providerPayment.paymentMethodType ?? payment.paymentMethod ?? 'yookassa_widget',
    });
  }

  private async handlePaymentCanceled(
    payment: PaymentRecord,
    providerPayment: Awaited<ReturnType<YooKassaClient['getPayment']>>,
  ): Promise<void> {
    const result = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: PrismaPaymentStatus.Pending,
      },
      data: {
        status: PrismaPaymentStatus.Failed,
        paymentMethod:
          providerPayment.paymentMethodType ?? payment.paymentMethod ?? 'yookassa_widget',
      },
    });

    if (result.count === 0) {
      return;
    }

    this.metrics.recordPayment('failed');
    this.metrics.recordBillingPayment('failed', resolveBillingPaymentMetricContext(payment.type));
    const failedPaymentMethod =
      providerPayment.paymentMethodType ?? payment.paymentMethod ?? 'yookassa_widget';

    await this.recordPaymentStatusAudit(
      payment,
      'payment.failed',
      PrismaPaymentStatus.Failed,
      {
        paymentMethod: failedPaymentMethod,
        paymentProvider: 'YooKassa',
        paymentMethodTitle: providerPayment.paymentMethodTitle,
      },
      'Статус обновлён по YooKassa webhook',
    );
    await this.paymentNotificationService.notifyPaymentFailed({
      ...payment,
      status: PrismaPaymentStatus.Failed,
      paymentMethod: failedPaymentMethod,
    });
  }

  private async recordPaymentStatusAudit(
    payment: PaymentRecord,
    eventType: 'payment.completed' | 'payment.failed',
    status: PrismaPaymentStatus,
    providerDetails: {
      paymentMethod: string;
      paymentProvider: string;
      paymentMethodTitle?: string | null;
      receiptRegistration?: string | null;
    },
    actionContext: string,
  ): Promise<void> {
    const target = buildPaymentAuditTarget(payment);

    await this.auditService.record({
      actorUserId: payment.userId,
      eventType,
      ...target,
      actionTitle: status === PrismaPaymentStatus.Completed ? 'Платёж завершён' : 'Платёж отклонён',
      actionContext,
      after: buildPaymentAuditSnapshot(payment, {
        status,
        ...providerDetails,
      }),
    });
  }

  private async recordRobokassaCallbackFailure(
    payment: PaymentRecord,
    payload: RobokassaResultPayload,
    errorMessage: string,
    statusCode: number,
  ): Promise<void> {
    const target = buildPaymentAuditTarget(payment);
    const paymentMethod = payment.paymentMethod ?? 'robokassa_redirect';

    await this.auditService.record({
      actorUserId: payment.userId,
      eventType: 'payment.failed',
      ...target,
      actionTitle: 'Ошибка Robokassa callback',
      actionContext: `Callback Robokassa отклонён: ${errorMessage}`,
      after: buildPaymentAuditSnapshot(
        {
          ...payment,
          paymentMethod,
        },
        {
          paymentProvider: 'Robokassa',
          callbackStatus: 'rejected',
          callbackInvoiceId: payload.invoiceId,
          callbackOutSum: payload.outSum,
          errorMessage,
          providerStatusCode: statusCode,
        },
      ),
    });

    await this.paymentNotificationService.notifyPaymentProviderIssue(
      {
        ...payment,
        paymentMethod,
      },
      'Robokassa',
      errorMessage,
    );
  }

  private async findPaymentById(paymentId: string): Promise<PaymentRecord | null> {
    return this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        userId: true,
        amount: true,
        status: true,
        type: true,
        promoId: true,
        discountAmount: true,
        subscriptionId: true,
        assessmentId: true,
        paymentMethod: true,
        transactionId: true,
        attachmentFileUrl: true,
        receiptStatus: true,
      },
    });
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
        discountAmount: true,
        subscriptionId: true,
        assessmentId: true,
        paymentMethod: true,
        transactionId: true,
        attachmentFileUrl: true,
        receiptStatus: true,
      },
    });
  }

  private async runCompletedPaymentHooks(
    tx: Prisma.TransactionClient,
    payment: Pick<PaymentRecord, 'id' | 'type' | 'subscriptionId' | 'assessmentId'>,
  ): Promise<void> {
    switch (payment.type) {
      case PrismaPaymentType.Subscription:
        if (payment.subscriptionId) {
          await this.paymentSubscriptionService.activateSubscription(tx, payment.subscriptionId);
        }
        return;

      case PrismaPaymentType.Assessment:
        this.logger.log(
          `Assessment payment ${payment.id} completed. Placeholder post-payment hook for assessment ${payment.assessmentId ?? 'unknown'}`,
        );
        return;

      case PrismaPaymentType.DocumentCopy:
        this.logger.log(
          `Document copy payment ${payment.id} completed. Placeholder post-payment hook is not implemented yet.`,
        );
        return;
    }
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

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
