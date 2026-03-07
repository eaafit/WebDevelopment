import {
  type TransactionHistoryQuery,
  type TransactionHistoryResponse,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHistoryRepository } from './transaction-history.repository';

@Injectable()
export class TransactionHistoryService {
  constructor(private readonly transactionHistoryRepository: TransactionHistoryRepository) {}

  getTransactionHistory(query: TransactionHistoryQuery): Promise<TransactionHistoryResponse> {
    return this.transactionHistoryRepository.getTransactionHistory(query);
  }
}
