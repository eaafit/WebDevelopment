import { TransactionHistoryService } from './transaction-history.service';

describe('TransactionHistoryService', () => {
  it('should delegate to the transaction history repository', async () => {
    const response = {
      transactions: [],
      meta: {
        totalItems: 0,
        totalPages: 1,
        currentPage: 1,
        perPage: 10,
      },
    };
    const transactionHistoryRepository = {
      getTransactionHistory: jest.fn().mockResolvedValue(response),
    };

    const service = new TransactionHistoryService(transactionHistoryRepository as never);

    await expect(service.getTransactionHistory({ page: 1, limit: 10 })).resolves.toEqual(response);
    expect(transactionHistoryRepository.getTransactionHistory).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
    });
  });
});
