import { Module } from '@nestjs/common';
import { PaymentCreateModule } from './payment-create/payment-create.module';
import { TransactionHistoryModule } from './transaction-history/transaction-history.module';

@Module({
  imports: [TransactionHistoryModule, PaymentCreateModule],
  exports: [TransactionHistoryModule, PaymentCreateModule],
})
export class BillingModule {}
