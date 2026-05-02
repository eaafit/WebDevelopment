import { AuditModule } from '@internal/audit';
import { NotificationModule } from '@internal/notification';
import { Module } from '@nestjs/common';
import { PaymentCreateModule } from '../payment-create/payment-create.module';
import { PaymentRpcService } from './payment-rpc.service';
import { TransactionHistoryRepository } from './transaction-history.repository';
import { TransactionHistoryService } from './transaction-history.service';

@Module({
  imports: [PaymentCreateModule, AuditModule, NotificationModule],
  providers: [PaymentRpcService, TransactionHistoryRepository, TransactionHistoryService],
  exports: [PaymentRpcService],
})
export class TransactionHistoryModule {}
