import { UserRole } from '@notary-portal/api-contracts';
import { AuditService } from '@internal/audit';
import { PrismaService } from '@internal/prisma';
import { PaymentReceiptStatus, type Payment } from '@internal/prisma-client';
import { S3StorageService } from '@internal/storage';
import {
  BusinessOperations,
  NotarySpanAttributes,
  SpanKind,
  normalizeSpanActorRole,
  normalizeSpanContentType,
  runInSpan,
  setSpanAttributes,
  spanSizeBucket,
} from '@internal/tracing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  buildStoredPaymentReceiptFileName,
  buildStoredPaymentReceiptObjectKey,
  renderStoredPaymentReceipt,
} from '../payment-receipt/payment-receipt.renderer';
import { buildPaymentAuditSnapshot, buildPaymentAuditTarget } from '../payment-audit';
import type { ProviderPaymentDetails } from '../payment-receipt/payment-receipt.renderer';

export interface PaymentAttachmentUpload {
  paymentId: string;
  userId: string;
  role: string;
  file: Express.Multer.File;
}

export interface PaymentReceiptDownloadRequest {
  paymentId: string;
  userId: string;
  role: string;
}

export interface PaymentReceiptDownload {
  body: Buffer;
  fileName: string;
  contentType: string;
}

@Injectable()
export class PaymentAttachmentService {
  private readonly logger = new Logger(PaymentAttachmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageService,
    private readonly auditService: AuditService,
  ) {}

  async attachPdf(
    input: PaymentAttachmentUpload,
  ): Promise<{ objectKey: string; fileName: string }> {
    return runInSpan(
      'PaymentAttachmentService.attachPdf',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.paymentReceiptAttach,
        [NotarySpanAttributes.entity]: 'PaymentReceipt',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(input.role),
        'payment.receipt.status': PaymentReceiptStatus.Available,
        'document.content_type': normalizeSpanContentType(input.file.mimetype),
        'document.size_bucket': spanSizeBucket(input.file.size),
      },
      async () => {
        const payment = await this.requirePaymentAccess(input.paymentId, input.userId, input.role);
        const buf = input.file.buffer;
        if (!buf?.length) {
          throw new BadRequestException('empty file');
        }

        const header = buf.subarray(0, 4).toString('latin1');
        if (header !== '%PDF') {
          throw new BadRequestException('not a PDF');
        }

        if (input.file.mimetype !== 'application/pdf') {
          throw new BadRequestException('invalid content type');
        }

        const fileName = sanitizeFilename(input.file.originalname);
        const objectKey = `payment-documents/${input.paymentId}/${randomUUID()}.pdf`;

        try {
          this.logger.log(
            'Payment receipt upload started; operation=payment.receipt.upload; source=manual; provider=s3; result=started; hasAttachment=true',
          );
          await runInSpan(
            'S3StorageService.putObject payment receipt',
            {
              [NotarySpanAttributes.operation]: BusinessOperations.paymentReceiptStoragePut,
              [NotarySpanAttributes.entity]: 'PaymentReceipt',
              'payment.receipt.status': PaymentReceiptStatus.Available,
              'document.content_type': normalizeSpanContentType('application/pdf'),
              'document.size_bucket': spanSizeBucket(buf.length),
            },
            () => this.s3.putObject(objectKey, buf, 'application/pdf'),
            { kind: SpanKind.CLIENT },
          );
        } catch {
          this.logger.error(
            'Payment receipt upload failed; operation=payment.receipt.upload; source=manual; provider=s3; result=error; hasAttachment=true',
          );
          throw new ServiceUnavailableException('object storage unavailable');
        }

        await this.prisma.payment.update({
          where: { id: input.paymentId },
          data: {
            attachmentFileName: fileName,
            attachmentFileUrl: objectKey,
            receiptStatus: PaymentReceiptStatus.Available,
          },
        });

        this.logger.log(
          'Payment receipt saved; operation=payment.receipt.attach; source=manual; result=success; hasAttachment=true',
        );
        await this.recordReceiptAttachedAudit(input.userId, payment, fileName, objectKey);
        return { objectKey, fileName };
      },
    );
  }

  async storeGeneratedReceipt(
    paymentId: string,
    providerPayment: ProviderPaymentDetails,
  ): Promise<{ objectKey: string; fileName: string }> {
    return runInSpan(
      'PaymentAttachmentService.storeGeneratedReceipt',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.paymentReceiptGenerateStore,
        [NotarySpanAttributes.entity]: 'PaymentReceipt',
        'payment.receipt.status': providerPayment.receiptRegistration,
        'document.content_type': normalizeSpanContentType('text/html; charset=utf-8'),
      },
      async (span) => {
        const payment = await this.prisma.payment.findUnique({
          where: { id: paymentId },
          include: {
            user: {
              select: {
                email: true,
                fullName: true,
              },
            },
            subscription: {
              select: {
                plan: true,
              },
            },
            assessment: {
              select: {
                address: true,
              },
            },
          },
        });

        if (!payment) {
          throw new NotFoundException('payment not found');
        }

        const objectKey = buildStoredPaymentReceiptObjectKey(payment.userId, payment.id);
        const fileName = buildStoredPaymentReceiptFileName(payment.id, payment.transactionId);
        const body = renderStoredPaymentReceipt({
          payment: {
            id: payment.id,
            userId: payment.userId,
            type: payment.type,
            amount: payment.amount.toString(),
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            transactionId: payment.transactionId,
          },
          user: payment.user,
          subscription: payment.subscription,
          assessment: payment.assessment,
          providerPayment,
        });
        setSpanAttributes(span, {
          'document.size_bucket': spanSizeBucket(body.length),
          'payment.receipt.status': mapReceiptStatus(providerPayment),
        });

        try {
          this.logger.log(
            'Payment receipt upload started; operation=payment.receipt.upload; source=generated; provider=s3; result=started; hasReceipt=true; hasAttachment=true',
          );
          await runInSpan(
            'S3StorageService.putObject generated payment receipt',
            {
              [NotarySpanAttributes.operation]: BusinessOperations.paymentReceiptStoragePut,
              [NotarySpanAttributes.entity]: 'PaymentReceipt',
              'document.content_type': normalizeSpanContentType('text/html; charset=utf-8'),
              'document.size_bucket': spanSizeBucket(body.length),
              'payment.receipt.status': mapReceiptStatus(providerPayment),
            },
            () => this.s3.putObject(objectKey, body, 'text/html; charset=utf-8'),
            { kind: SpanKind.CLIENT },
          );
        } catch {
          this.logger.error(
            'Payment receipt upload failed; operation=payment.receipt.upload; source=generated; provider=s3; result=error; hasReceipt=true; hasAttachment=true',
          );
          throw new ServiceUnavailableException('object storage unavailable');
        }

        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            attachmentFileName: fileName,
            attachmentFileUrl: objectKey,
            receiptStatus: mapReceiptStatus(providerPayment),
          },
        });

        this.logger.log(
          'Payment receipt saved; operation=payment.receipt.generate_store; source=generated; result=success; hasReceipt=true; hasAttachment=true',
        );
        return { objectKey, fileName };
      },
    );
  }

  async markReceiptFailed(paymentId: string): Promise<void> {
    await runInSpan(
      'PaymentAttachmentService.markReceiptFailed',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.paymentReceiptFailure,
        [NotarySpanAttributes.entity]: 'PaymentReceipt',
        'payment.receipt.status': PaymentReceiptStatus.Failed,
      },
      () =>
        this.prisma.payment.update({
          where: { id: paymentId },
          data: {
            receiptStatus: PaymentReceiptStatus.Failed,
          },
        }),
    );
  }

  async getReceiptFile(input: PaymentReceiptDownloadRequest): Promise<PaymentReceiptDownload> {
    return runInSpan(
      'PaymentAttachmentService.getReceiptFile',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.paymentReceiptOpen,
        [NotarySpanAttributes.entity]: 'PaymentReceipt',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(input.role),
      },
      async (span) => {
        const payment = await this.requirePaymentAccess(input.paymentId, input.userId, input.role);
        setSpanAttributes(span, { 'payment.receipt.status': payment.receiptStatus });

        if (payment.receiptStatus === PaymentReceiptStatus.Pending) {
          await this.recordReceiptOpenFailedAudit(input.userId, payment, 'receipt_pending');
          throw new ConflictException('receipt is not ready yet');
        }

        if (payment.receiptStatus === PaymentReceiptStatus.Failed) {
          await this.recordReceiptOpenFailedAudit(input.userId, payment, 'receipt_failed');
          throw new NotFoundException('receipt not found');
        }

        if (!payment.attachmentFileUrl?.trim()) {
          await this.recordReceiptOpenFailedAudit(input.userId, payment, 'receipt_missing');
          throw new NotFoundException('receipt not found');
        }

        try {
          const object = await runInSpan(
            'S3StorageService.getObject payment receipt',
            {
              [NotarySpanAttributes.operation]: BusinessOperations.paymentReceiptStorageGet,
              [NotarySpanAttributes.entity]: 'PaymentReceipt',
              'payment.receipt.status': payment.receiptStatus,
            },
            () => this.s3.getObject(payment.attachmentFileUrl as string),
            { kind: SpanKind.CLIENT },
          );
          const fileName =
            payment.attachmentFileName?.trim() ||
            buildStoredPaymentReceiptFileName(payment.id, payment.transactionId);
          const contentType = object.contentType ?? guessContentType(payment.attachmentFileName);
          setSpanAttributes(span, {
            'document.content_type': normalizeSpanContentType(contentType),
            'document.size_bucket': spanSizeBucket(object.body.length),
          });

          await this.recordReceiptOpenedAudit(input.userId, payment, fileName, contentType);

          return {
            body: object.body,
            fileName,
            contentType,
          };
        } catch (error) {
          if (isMissingObjectError(error)) {
            this.logger.warn(
              'Payment receipt object missing; operation=payment.receipt.open; provider=s3; result=missing; hasAttachment=true',
            );
            await this.prisma.payment.update({
              where: { id: payment.id },
              data: {
                receiptStatus: PaymentReceiptStatus.Failed,
                attachmentFileName: null,
                attachmentFileUrl: null,
              },
            });
            await this.recordReceiptOpenFailedAudit(
              input.userId,
              payment,
              'receipt_object_missing',
            );
            throw new NotFoundException('receipt file is missing');
          }

          this.logger.error(
            'Payment receipt object read failed; operation=payment.receipt.open; provider=s3; result=error; hasAttachment=true',
          );
          await this.recordReceiptOpenFailedAudit(
            input.userId,
            payment,
            'object_storage_unavailable',
          );
          throw new ServiceUnavailableException('object storage unavailable');
        }
      },
    );
  }

  private async recordReceiptAttachedAudit(
    actorUserId: string,
    payment: Payment,
    fileName: string,
    objectKey: string,
  ): Promise<void> {
    const target = buildPaymentAuditTarget(payment);

    await this.auditService.record({
      actorUserId,
      eventType: 'payment.receipt.attached',
      ...target,
      actionTitle: 'Чек прикреплён',
      actionContext: 'Ручная загрузка чека платежа',
      after: buildPaymentAuditSnapshot(payment, {
        receiptStatus: PaymentReceiptStatus.Available,
        attachmentFileName: fileName,
        hasAttachment: true,
        objectKey,
      }),
    });
  }

  private async recordReceiptOpenedAudit(
    actorUserId: string,
    payment: Payment,
    fileName: string,
    contentType: string,
  ): Promise<void> {
    const target = buildPaymentAuditTarget(payment);

    await this.auditService.record({
      actorUserId,
      eventType: 'payment.receipt.opened',
      ...target,
      actionTitle: 'Открыт чек платежа',
      actionContext: 'Пользователь открыл чек из истории платежей',
      after: buildPaymentAuditSnapshot(payment, {
        attachmentFileName: fileName,
        contentType,
      }),
    });
  }

  private async recordReceiptOpenFailedAudit(
    actorUserId: string,
    payment: Payment,
    reason: string,
  ): Promise<void> {
    const target = buildPaymentAuditTarget(payment);

    await this.auditService.record({
      actorUserId,
      eventType: 'payment.receipt.failed',
      ...target,
      actionTitle: 'Чек платежа не открыт',
      actionContext: 'Не удалось открыть чек из истории платежей',
      after: buildPaymentAuditSnapshot(payment, {
        failureReason: reason,
      }),
    });
  }

  private async requirePaymentAccess(
    paymentId: string,
    userId: string,
    role: string,
  ): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('payment not found');
    }

    const isAdmin = role === UserRole.ADMIN.toString();
    if (!isAdmin && payment.userId !== userId) {
      throw new ForbiddenException();
    }

    return payment;
  }
}

function sanitizeFilename(name: string): string {
  const base = name
    .replace(/^.*[/\\]/, '')
    .trim()
    .slice(0, 200);
  return base.length > 0 ? base : 'document.pdf';
}

function guessContentType(fileName: string | null): string {
  if (fileName?.toLowerCase().endsWith('.pdf')) {
    return 'application/pdf';
  }

  if (fileName?.toLowerCase().endsWith('.html')) {
    return 'text/html; charset=utf-8';
  }

  return 'application/octet-stream';
}

function isMissingObjectError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === 'NoSuchKey' ||
    candidate.Code === 'NoSuchKey' ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

function mapReceiptStatus(providerPayment: ProviderPaymentDetails): PaymentReceiptStatus {
  switch (providerPayment.receiptRegistration) {
    case 'succeeded':
      return PaymentReceiptStatus.Available;
    case 'canceled':
      return PaymentReceiptStatus.Failed;
    case 'pending':
      return PaymentReceiptStatus.Pending;
    default:
      return PaymentReceiptStatus.Pending;
  }
}
