import { PaymentStatus, PaymentType, SubscriptionPlan } from '@internal/prisma-client';
import { TransactionHistoryRepository } from './transaction-history.repository';

describe('TransactionHistoryRepository', () => {
  const count = jest.fn();
  const findMany = jest.fn();
  const prisma = {
    payment: {
      count,
      findMany,
    },
    $transaction: jest.fn((operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };

  const repository = new TransactionHistoryRepository(prisma as never);

  beforeEach(() => {
    count.mockReset();
    findMany.mockReset();
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
    expect(response.meta).toEqual({
      totalItems: 21,
      totalPages: 3,
      currentPage: 2,
      perPage: 10,
    });
    expect(response.transactions).toHaveLength(1);
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
});
