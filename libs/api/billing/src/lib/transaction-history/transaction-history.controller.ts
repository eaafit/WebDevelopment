import { type TransactionHistoryResponse } from '@notary-portal/api-contracts';
import { Controller, Get, Query } from '@nestjs/common';
import { parseTransactionHistoryQuery } from './dto/get-transaction-history.query';
import { TransactionHistoryService } from './transaction-history.service';

@Controller('transaction-history')
export class TransactionHistoryController {
  constructor(private readonly transactionHistoryService: TransactionHistoryService) {}

  @Get()
  getTransactionHistory(
    @Query() query: Record<string, string | string[] | undefined>,
  ): Promise<TransactionHistoryResponse> {
    return this.transactionHistoryService.getTransactionHistory(
      parseTransactionHistoryQuery(query),
    );
  }
}
