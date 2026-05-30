import {
  PaymentReceiptStatus as RpcPaymentReceiptStatus,
  PaymentStatus as RpcPaymentStatus,
  PaymentType as RpcPaymentType,
  type UpdatePaymentRequest,
  type DeletePaymentRequest,
} from '@notary-portal/api-contracts';
import {
  PaymentReceiptStatus,
  PaymentStatus,
  PaymentType,
  SubscriptionPlan,
} from '@internal/prisma-client';
import { TransactionHistoryRepository } from './transaction-history.repository';

describe('TransactionHistoryRepository', () => {
  const count = jest.fn();
  const findMany = jest.fn();
  const update = jest.fn();
  const deleteFn = jest.fn();
  const prisma = {
    payment: {
      count,
      findMany,
      update,
      delete: deleteFn,
    },
    $transaction: jest.fn((operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };

  const repository = new TransactionHistoryRepository(prisma as never);

  beforeEach(() => {
    count.mockReset();
    findMany.mockReset();
    update.mockReset();
    deleteFn.mockReset();
    prisma.$transaction.mockClear();

    count.mockResolvedValue(21);
    findMany.mockResolvedValue([
      {
        id: 'payment-1',
        userId: 'user-1',
        type: PaymentType.Subscription,
        status: PaymentStatus.Completed,
        paymentDate: new Date('2026-03-06T08:45:00.000Z'),
        transactionId: 'TXN-1001',
        amount: {
          toString: () => '4990.00',
        },
        paymentMethod: 'bank_card',
        attachmentFileName: 'receipt.pdf',
        attachmentFileUrl: 'https://example.local/receipt.pdf',
        receiptStatus: PaymentReceiptStatus.Available,
        subscriptionId: 'subscription-1',
        assessmentId: null,
        subscription: {
          plan: SubscriptionPlan.Premium,
          startDate: new Date('2026-02-15T00:00:00.000Z'),
          endDate: new Date('2026-03-17T00:00:00.000Z'),
        },
        assessment: null,
      },
    ]);
  });

  it('should request a full page with deterministic sorting', async () => {
    const response = await repository.getTransactionHistory({ page: 2, limit: 10 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(response.meta).toEqual(
      expect.objectContaining({
        totalItems: 21,
        totalPages: 3,
        currentPage: 2,
        perPage: 10,
      }),
    );
    expect(response.payments).toHaveLength(1);
    expect(response.payments[0]).toEqual(
      expect.objectContaining({
        status: RpcPaymentStatus.COMPLETED,
        type: RpcPaymentType.SUBSCRIPTION,
        hasReceipt: true,
        receiptStatus: RpcPaymentReceiptStatus.AVAILABLE,
      }),
    );
  });

  it('should hide receipt availability when receipt is marked as failed', async () => {
    findMany.mockResolvedValue([
      {
        id: 'payment-1',
        userId: 'user-1',
        type: PaymentType.Subscription,
        status: PaymentStatus.Completed,
        paymentDate: new Date('2026-03-06T08:45:00.000Z'),
        transactionId: 'TXN-1001',
        amount: {
          toString: () => '4990.00',
        },
        paymentMethod: 'bank_card',
        attachmentFileName: 'receipt.pdf',
        attachmentFileUrl: 'https://example.local/receipt.pdf',
        receiptStatus: PaymentReceiptStatus.Failed,
        subscriptionId: 'subscription-1',
        assessmentId: null,
        subscription: {
          plan: SubscriptionPlan.Premium,
          startDate: new Date('2026-02-15T00:00:00.000Z'),
          endDate: new Date('2026-03-17T00:00:00.000Z'),
        },
        assessment: null,
      },
    ]);

    const response = await repository.getTransactionHistory({ page: 1, limit: 10 });

    expect(response.payments[0]).toEqual(
      expect.objectContaining({
        hasReceipt: false,
        receiptStatus: RpcPaymentReceiptStatus.FAILED,
      }),
    );
  });

  it('should translate user-facing search aliases into prisma filters', async () => {
    await repository.getTransactionHistory({
      page: 1,
      limit: 10,
      searchQuery: 'СБП премиум',
    });

    const where = findMany.mock.calls[0][0].where;

    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paymentMethod: 'sbp',
        }),
        expect.objectContaining({
          subscription: {
            is: {
              plan: SubscriptionPlan.Premium,
            },
          },
        }),
      ]),
    );
  });

  it('should search by payment id or user id when query is UUID', async () => {
    const id = 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890';

    await repository.getTransactionHistory({
      page: 1,
      limit: 10,
      searchQuery: id,
    });

    const where = findMany.mock.calls[0][0].where;

    expect(where.OR).toEqual(
      expect.arrayContaining([
        { id },
        { userId: id },
      ]),
    );
  });

  describe('updatePayment', () => {
    const updatedRecord = {
      id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890',
      userId: 'user-1',
      type: PaymentType.Subscription,
      status: PaymentStatus.Completed,
      paymentDate: new Date('2026-03-06T08:45:00.000Z'),
      transactionId: 'TXN-1001',
      amount: {
        toString: () => '5000.00',
      },
      paymentMethod: 'bank_card',
      attachmentFileName: 'receipt.pdf',
      attachmentFileUrl: 'https://example.local/receipt.pdf',
      receiptStatus: PaymentReceiptStatus.Available,
      subscriptionId: 'subscription-1',
      assessmentId: null,
      subscription: {
        plan: SubscriptionPlan.Premium,
        startDate: new Date('2026-02-15T00:00:00.000Z'),
        endDate: new Date('2026-03-17T00:00:00.000Z'),
      },
      assessment: null,
    };

    it('should update only provided fields', async () => {
      update.mockResolvedValue(updatedRecord);

      const request = {
        id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890',
        amount: '5000.00',
        status: RpcPaymentStatus.COMPLETED,
      } as UpdatePaymentRequest;

      const response = await repository.updatePayment(request);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890' },
          data: expect.objectContaining({
            amount: '5000.00',
            status: PaymentStatus.Completed,
          }),
        }),
      );
      expect(response.payment).toBeDefined();
      expect(response.payment?.id).toBe('a1b2c3d4-e5f6-4bcd-abcd-ef1234567890');
    });

    it('should map status to Prisma enum', async () => {
      update.mockResolvedValue(updatedRecord);

      const request = {
        id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890',
        status: RpcPaymentStatus.REFUNDED,
      } as UpdatePaymentRequest;

      await repository.updatePayment(request);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.Refunded,
          }),
        }),
      );
    });

    it('should set nullable fields to null when empty string provided', async () => {
      update.mockResolvedValue(updatedRecord);

      const request = {
        id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890',
        transactionId: '',
        attachmentFileName: '',
      } as UpdatePaymentRequest;

      await repository.updatePayment(request);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transactionId: null,
            attachmentFileName: null,
          }),
        }),
      );
    });
  });

  describe('deletePayment', () => {
    it('should delete a payment by id and return success', async () => {
      deleteFn.mockResolvedValue({ id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890' });

      const request = { id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890' } as DeletePaymentRequest;

      const response = await repository.deletePayment(request);

      expect(deleteFn).toHaveBeenCalledWith({
        where: { id: 'a1b2c3d4-e5f6-4bcd-abcd-ef1234567890' },
      });
      expect(response.success).toBe(true);
    });
  });
});
