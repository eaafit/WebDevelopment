import { Module } from '@nestjs/common';
import { TransactionHistoryModule } from './transaction-history/transaction-history.module';

@Module({
  imports: [TransactionHistoryModule],
})
export class BillingModule {}
