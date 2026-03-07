import { create } from '@bufbuild/protobuf';
import {
  GetPaymentHistoryRequestSchema,
  GetPaymentHistoryResponseSchema,
} from '@notary-portal/api-contracts';
import { TransactionHistoryService } from './transaction-history.service';

describe('TransactionHistoryService', () => {
  it('should delegate to the transaction history repository', async () => {
    const response = create(GetPaymentHistoryResponseSchema, {
      payments: [],
      meta: {
        totalItems: 0,
        totalPages: 1,
        currentPage: 1,
        perPage: 10,
      },
    });
    const transactionHistoryRepository = {
      getTransactionHistory: jest.fn().mockResolvedValue(response),
    };

    const service = new TransactionHistoryService(transactionHistoryRepository as never);
    const request = create(GetPaymentHistoryRequestSchema, {
      pagination: {
        page: 1,
        limit: 10,
      },
    });

    await expect(service.getPaymentHistory(request)).resolves.toEqual(response);
    expect(transactionHistoryRepository.getTransactionHistory).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
    });
  });
});
