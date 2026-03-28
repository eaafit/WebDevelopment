import { UserRole } from '@notary-portal/api-contracts';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentAttachmentService } from './payment-attachment.service';

function pdfFile(buffer: Buffer, name = 'doc.pdf'): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer,
    size: buffer.length,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
  };
}

describe('PaymentAttachmentService', () => {
  const findUnique = jest.fn();
  const update = jest.fn();
  const putObject = jest.fn();

  const prisma = {
    payment: {
      findUnique,
      update,
    },
  };

  const s3 = {
    putObject,
    bucketName: 'payment-documents',
  };

  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    putObject.mockReset();
  });

  it('throws NotFoundException when payment is missing', async () => {
    findUnique.mockResolvedValue(null);
    const service = new PaymentAttachmentService(prisma as never, s3 as never);
    const file = pdfFile(Buffer.from('%PDF-1.4\n'));

    await expect(
      service.attachPdf({
        paymentId: 'p1',
        userId: 'u1',
        role: UserRole.APPLICANT.toString(),
        file,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(putObject).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when user is not owner and not admin', async () => {
    findUnique.mockResolvedValue({ id: 'p1', userId: 'other-user' });
    const service = new PaymentAttachmentService(prisma as never, s3 as never);
    const file = pdfFile(Buffer.from('%PDF-1.4\n'));

    await expect(
      service.attachPdf({
        paymentId: 'p1',
        userId: 'u1',
        role: UserRole.APPLICANT.toString(),
        file,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(putObject).not.toHaveBeenCalled();
  });

  it('allows admin to attach to any payment', async () => {
    findUnique.mockResolvedValue({ id: 'p1', userId: 'other-user' });
    putObject.mockResolvedValue(undefined);
    update.mockResolvedValue(undefined);
    const service = new PaymentAttachmentService(prisma as never, s3 as never);
    const body = Buffer.from('%PDF-1.4\n');
    const file = pdfFile(body);

    const result = await service.attachPdf({
      paymentId: 'p1',
      userId: 'admin-id',
      role: UserRole.ADMIN.toString(),
      file,
    });

    expect(result.fileName).toBe('doc.pdf');
    expect(result.objectKey).toMatch(/^payment-documents\/p1\/[0-9a-f-]{36}\.pdf$/);
    expect(putObject).toHaveBeenCalledWith(result.objectKey, body, 'application/pdf');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        attachmentFileName: 'doc.pdf',
        attachmentFileUrl: result.objectKey,
      },
    });
  });

  it('rejects non-PDF payload', async () => {
    findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' });
    const service = new PaymentAttachmentService(prisma as never, s3 as never);
    const file = pdfFile(Buffer.from('not pdf'));

    await expect(
      service.attachPdf({
        paymentId: 'p1',
        userId: 'u1',
        role: UserRole.APPLICANT.toString(),
        file,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(putObject).not.toHaveBeenCalled();
  });
});
