import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import {
  PaymentReceiptStatus,
  PaymentStatus,
  PaymentType,
  type GetPaymentHistoryResponse,
} from '@notary-portal/api-contracts';
import {
  buildPaymentHistoryRequest,
  toPaymentHistoryPage,
  toTransactionHistoryPage,
} from './payment-history-mapper';

describe('payment history mapper', () => {
  it('should build a typed payment history request with filters', () => {
    const request = buildPaymentHistoryRequest({
      page: 2,
      limit: 25,
      searchQuery: '  txn_100  ',
      statuses: [PaymentStatus.COMPLETED, PaymentStatus.REFUNDED],
      types: [PaymentType.ASSESSMENT],
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
    });

    expect(request.pagination).toEqual({ page: 2, limit: 25 });
    expect(request.filters.searchQuery).toBe('txn_100');
    expect(request.filters.statuses).toEqual([PaymentStatus.COMPLETED, PaymentStatus.REFUNDED]);
    expect(request.filters.types).toEqual([PaymentType.ASSESSMENT]);
    const paymentDateRange = request.filters.paymentDateRange;
    expect(paymentDateRange?.startDate).toBeDefined();
    expect(paymentDateRange?.endDate).toBeDefined();

    if (!paymentDateRange?.startDate || !paymentDateRange.endDate) {
      throw new Error('Expected payment date range to include start and end dates');
    }

    expect(timestampDate(paymentDateRange.startDate).toISOString()).toBe(
      '2026-03-01T00:00:00.000Z',
    );
    expect(timestampDate(paymentDateRange.endDate).toISOString()).toBe('2026-03-31T23:59:59.999Z');
  });

  it('should map payment history response into normalized records and transaction rows', () => {
    const response = {
      payments: [
        {
          id: 'payment-1',
          userId: 'user-1',
          type: PaymentType.DOCUMENT_COPY,
          status: PaymentStatus.COMPLETED,
          paymentDate: timestampFromDate(new Date('2026-03-06T08:45:00.000Z')),
          transactionId: ' txn_100 ',
          amount: { amount: '1234.56', currency: 'RUB' },
          description: 'Копия документа',
          paymentMethod: 'bank_card',
          attachmentFileName: ' receipt.html ',
          attachmentFileUrl: 'https://example.local/receipt.html',
          subscriptionId: '',
          assessmentId: 'assessment-1',
          hasReceipt: true,
          receiptStatus: PaymentReceiptStatus.AVAILABLE,
        },
      ],
      meta: {
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        perPage: 25,
      },
    } as GetPaymentHistoryResponse;

    expect(toPaymentHistoryPage(response)).toEqual({
      payments: [
        expect.objectContaining({
          id: 'payment-1',
          type: PaymentType.DOCUMENT_COPY,
          status: PaymentStatus.COMPLETED,
          paymentDate: '2026-03-06T08:45:00.000Z',
          transactionId: 'txn_100',
          amount: '1234.56',
          currency: 'RUB',
          subscriptionId: null,
          assessmentId: 'assessment-1',
        }),
      ],
      meta: {
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        perPage: 25,
      },
    });

    expect(toTransactionHistoryPage(response).transactions[0]).toEqual(
      expect.objectContaining({
        type: 'document_copy',
        status: 'completed',
        receiptStatus: 'available',
        transactionId: 'txn_100',
      }),
    );
  });
});
