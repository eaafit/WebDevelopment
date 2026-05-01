import { UserRole } from '@notary-portal/api-contracts';
import { PaymentReceiptStatus, PaymentType, SubscriptionPlan } from '@internal/prisma-client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
  const getObject = jest.fn();

  const prisma = {
    payment: {
      findUnique,
      update,
    },
  };

  const s3 = {
    putObject,
    getObject,
    bucketName: 'payment-documents',
  };

  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    putObject.mockReset();
    getObject.mockReset();
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
        receiptStatus: PaymentReceiptStatus.Available,
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

  it('stores a generated receipt copy and marks it as available', async () => {
    findUnique.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      type: PaymentType.Subscription,
      amount: {
        toString: () => '1350.00',
      },
      paymentDate: new Date('2026-03-06T08:45:00.000Z'),
      paymentMethod: 'bank_card',
      transactionId: 'yk-payment-1',
      user: {
        email: 'notary@example.com',
        fullName: 'Иван Иванов',
      },
      subscription: {
        plan: SubscriptionPlan.Premium,
      },
      assessment: null,
    });
    putObject.mockResolvedValue(undefined);
    update.mockResolvedValue(undefined);

    const service = new PaymentAttachmentService(prisma as never, s3 as never);
    const result = await service.storeGeneratedReceipt('payment-1', {
      id: 'yk-payment-1',
      status: 'succeeded',
      paid: true,
      amountValue: '1350.00',
      amountCurrency: 'RUB',
      paymentMethodType: 'bank_card',
      paymentMethodTitle: 'Bank card *4477',
      receiptRegistration: 'succeeded',
      createdAt: '2026-03-06T08:40:00.000Z',
      capturedAt: '2026-03-06T08:45:00.000Z',
      metadata: { payment_id: 'payment-1' },
    });

    expect(result.fileName).toBe('receipt-yk-payment-1.html');
    expect(result.objectKey).toBe(
      'payment-documents/receipts/user-1/payment-1/yookassa-receipt.html',
    );
    expect(putObject).toHaveBeenCalledWith(
      result.objectKey,
      expect.any(Buffer),
      'text/html; charset=utf-8',
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: {
        attachmentFileName: 'receipt-yk-payment-1.html',
        attachmentFileUrl: result.objectKey,
        receiptStatus: PaymentReceiptStatus.Available,
      },
    });
  });

  it('stores generated receipt as pending until YooKassa confirms receipt registration', async () => {
    findUnique.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      type: PaymentType.Subscription,
      amount: {
        toString: () => '1350.00',
      },
      paymentDate: new Date('2026-03-06T08:45:00.000Z'),
      paymentMethod: 'bank_card',
      transactionId: 'yk-payment-1',
      user: {
        email: 'notary@example.com',
        fullName: 'Иван Иванов',
      },
      subscription: {
        plan: SubscriptionPlan.Premium,
      },
      assessment: null,
    });
    putObject.mockResolvedValue(undefined);
    update.mockResolvedValue(undefined);

    const service = new PaymentAttachmentService(prisma as never, s3 as never);
    const result = await service.storeGeneratedReceipt('payment-1', {
      id: 'yk-payment-1',
      status: 'succeeded',
      paid: true,
      amountValue: '1350.00',
      amountCurrency: 'RUB',
      paymentMethodType: 'bank_card',
      paymentMethodTitle: 'Bank card *4477',
      receiptRegistration: 'pending',
      createdAt: '2026-03-06T08:40:00.000Z',
      capturedAt: '2026-03-06T08:45:00.000Z',
      metadata: { payment_id: 'payment-1' },
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: {
        attachmentFileName: 'receipt-yk-payment-1.html',
        attachmentFileUrl: result.objectKey,
        receiptStatus: PaymentReceiptStatus.Pending,
      },
    });
  });

  it('marks a stored local receipt as available when a paid payment has no YooKassa receipt registration', async () => {
    findUnique.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      type: PaymentType.Subscription,
      amount: {
        toString: () => '1500.00',
      },
      paymentDate: new Date('2026-04-25T05:53:54.785Z'),
      paymentMethod: 'bank_card',
      transactionId: 'yk-payment-1',
      user: {
        email: 'notary@example.com',
        fullName: 'Иван Иванов',
      },
      subscription: {
        plan: SubscriptionPlan.Basic,
      },
      assessment: null,
    });
    putObject.mockResolvedValue(undefined);
    update.mockResolvedValue(undefined);

    const service = new PaymentAttachmentService(prisma as never, s3 as never);
    const result = await service.storeGeneratedReceipt('payment-1', {
      id: 'yk-payment-1',
      status: 'succeeded',
      paid: true,
      amountValue: '1500.00',
      amountCurrency: 'RUB',
      paymentMethodType: 'bank_card',
      paymentMethodTitle: 'Bank card *4477',
      receiptRegistration: null,
      createdAt: '2026-04-25T05:52:31.611Z',
      capturedAt: '2026-04-25T05:53:54.785Z',
      metadata: { payment_id: 'payment-1' },
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: {
        attachmentFileName: 'receipt-yk-payment-1.html',
        attachmentFileUrl: result.objectKey,
        receiptStatus: PaymentReceiptStatus.Available,
      },
    });
  });

  it('downloads a stored receipt for the payment owner', async () => {
    findUnique.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      attachmentFileName: 'receipt-yk-payment-1.html',
      attachmentFileUrl: 'payment-documents/receipts/user-1/payment-1/yookassa-receipt.html',
      transactionId: 'yk-payment-1',
      receiptStatus: PaymentReceiptStatus.Available,
    });
    getObject.mockResolvedValue({
      body: Buffer.from('<html></html>'),
      contentType: 'text/html; charset=utf-8',
      contentLength: 13,
    });

    const service = new PaymentAttachmentService(prisma as never, s3 as never);
    const result = await service.getReceiptFile({
      paymentId: 'payment-1',
      userId: 'user-1',
      role: UserRole.NOTARY.toString(),
    });

    expect(result.fileName).toBe('receipt-yk-payment-1.html');
    expect(result.contentType).toBe('text/html; charset=utf-8');
    expect(result.body.toString()).toContain('<html>');
  });

  it('returns ConflictException when receipt is still pending', async () => {
    findUnique.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      attachmentFileName: 'receipt-yk-payment-1.html',
      attachmentFileUrl: 'payment-documents/receipts/user-1/payment-1/yookassa-receipt.html',
      transactionId: 'yk-payment-1',
      receiptStatus: PaymentReceiptStatus.Pending,
    });

    const service = new PaymentAttachmentService(prisma as never, s3 as never);

    await expect(
      service.getReceiptFile({
        paymentId: 'payment-1',
        userId: 'user-1',
        role: UserRole.NOTARY.toString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(getObject).not.toHaveBeenCalled();
  });

  it('marks receipt as failed and clears stale object reference when file is missing in storage', async () => {
    findUnique.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      attachmentFileName: 'receipt-yk-payment-1.html',
      attachmentFileUrl: 'payment-documents/receipts/user-1/payment-1/yookassa-receipt.html',
      transactionId: 'yk-payment-1',
      receiptStatus: PaymentReceiptStatus.Available,
    });
    getObject.mockRejectedValue({ name: 'NoSuchKey' });
    update.mockResolvedValue(undefined);

    const service = new PaymentAttachmentService(prisma as never, s3 as never);

    await expect(
      service.getReceiptFile({
        paymentId: 'payment-1',
        userId: 'user-1',
        role: UserRole.NOTARY.toString(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: {
        receiptStatus: PaymentReceiptStatus.Failed,
        attachmentFileName: null,
        attachmentFileUrl: null,
      },
    });
  });
});
