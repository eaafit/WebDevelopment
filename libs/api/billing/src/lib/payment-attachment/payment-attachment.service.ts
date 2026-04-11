import { UserRole } from '@notary-portal/api-contracts';
import { PrismaService } from '@internal/prisma';
import { PaymentReceiptStatus, type Payment } from '@internal/prisma-client';
import { S3StorageService } from '@internal/storage';
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
import type { YooKassaPaymentDetails } from '../yookassa/yookassa.client';

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
  ) {}

  async attachPdf(
    input: PaymentAttachmentUpload,
  ): Promise<{ objectKey: string; fileName: string }> {
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
      this.logger.log(`Uploading manual payment receipt for payment ${payment.id} to ${objectKey}`);
      await this.s3.putObject(objectKey, buf, 'application/pdf');
    } catch {
      this.logger.error(
        `Failed to upload manual payment receipt for payment ${payment.id} to ${objectKey}`,
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

    this.logger.log(`Manual payment receipt saved for payment ${payment.id}`);
    return { objectKey, fileName };
  }

  async storeGeneratedReceipt(
    paymentId: string,
    providerPayment: YooKassaPaymentDetails,
  ): Promise<{ objectKey: string; fileName: string }> {
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

    try {
      this.logger.log(
        `Uploading generated payment receipt for payment ${payment.id} to ${objectKey}`,
      );
      await this.s3.putObject(objectKey, body, 'text/html; charset=utf-8');
    } catch {
      this.logger.error(
        `Failed to upload generated payment receipt for payment ${payment.id} to ${objectKey}`,
      );
      throw new ServiceUnavailableException('object storage unavailable');
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        attachmentFileName: fileName,
        attachmentFileUrl: objectKey,
        receiptStatus: PaymentReceiptStatus.Available,
      },
    });

    this.logger.log(`Generated payment receipt saved for payment ${payment.id}`);
    return { objectKey, fileName };
  }

  async markReceiptFailed(paymentId: string): Promise<void> {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        receiptStatus: PaymentReceiptStatus.Failed,
      },
    });
  }

  async getReceiptFile(input: PaymentReceiptDownloadRequest): Promise<PaymentReceiptDownload> {
    const payment = await this.requirePaymentAccess(input.paymentId, input.userId, input.role);

    if (!payment.attachmentFileUrl?.trim()) {
      if (payment.receiptStatus === PaymentReceiptStatus.Pending) {
        throw new ConflictException('receipt is not ready yet');
      }

      throw new NotFoundException('receipt not found');
    }

    try {
      const object = await this.s3.getObject(payment.attachmentFileUrl);

      return {
        body: object.body,
        fileName:
          payment.attachmentFileName?.trim() ||
          buildStoredPaymentReceiptFileName(payment.id, payment.transactionId),
        contentType: object.contentType ?? guessContentType(payment.attachmentFileName),
      };
    } catch (error) {
      if (isMissingObjectError(error)) {
        this.logger.warn(
          `Receipt object ${payment.attachmentFileUrl} is missing for payment ${payment.id}`,
        );
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            receiptStatus: PaymentReceiptStatus.Failed,
            attachmentFileName: null,
            attachmentFileUrl: null,
          },
        });
        throw new NotFoundException('receipt file is missing');
      }

      this.logger.error(`Failed to read receipt object ${payment.attachmentFileUrl}`);
      throw new ServiceUnavailableException('object storage unavailable');
    }
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
