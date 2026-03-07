import { Module } from '@nestjs/common';
import { TransactionHistoryController } from './transaction-history.controller';
import { TransactionHistoryRepository } from './transaction-history.repository';
import { TransactionHistoryService } from './transaction-history.service';

@Module({
  controllers: [TransactionHistoryController],
  providers: [TransactionHistoryRepository, TransactionHistoryService],
})
export class TransactionHistoryModule {}
