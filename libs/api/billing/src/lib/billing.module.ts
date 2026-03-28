import { StorageModule } from '@internal/storage';
import { Module } from '@nestjs/common';
import { PaymentAttachmentService } from './payment-attachment/payment-attachment.service';
import { PaymentCreateModule } from './payment-create/payment-create.module';
import { TransactionHistoryModule } from './transaction-history/transaction-history.module';

@Module({
  imports: [TransactionHistoryModule, PaymentCreateModule, StorageModule],
  providers: [PaymentAttachmentService],
  exports: [TransactionHistoryModule, PaymentCreateModule, PaymentAttachmentService],
})
export class BillingModule {}
