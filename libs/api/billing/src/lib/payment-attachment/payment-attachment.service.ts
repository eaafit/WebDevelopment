import { UserRole } from '@notary-portal/api-contracts';
import { PrismaService } from '@internal/prisma';
import { S3StorageService } from '@internal/storage';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface PaymentAttachmentUpload {
  paymentId: string;
  userId: string;
  role: string;
  file: Express.Multer.File;
}

@Injectable()
export class PaymentAttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageService,
  ) {}

  async attachPdf(
    input: PaymentAttachmentUpload,
  ): Promise<{ objectKey: string; fileName: string }> {
    const payment = await this.prisma.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment) {
      throw new NotFoundException('payment not found');
    }

    const isAdmin = input.role === UserRole.ADMIN.toString();
    if (!isAdmin && payment.userId !== input.userId) {
      throw new ForbiddenException();
    }

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
      await this.s3.putObject(objectKey, buf, 'application/pdf');
    } catch {
      throw new ServiceUnavailableException('object storage unavailable');
    }

    await this.prisma.payment.update({
      where: { id: input.paymentId },
      data: {
        attachmentFileName: fileName,
        attachmentFileUrl: objectKey,
      },
    });

    return { objectKey, fileName };
  }
}

function sanitizeFilename(name: string): string {
  const base = name
    .replace(/^.*[/\\]/, '')
    .trim()
    .slice(0, 200);
  return base.length > 0 ? base : 'document.pdf';
}
