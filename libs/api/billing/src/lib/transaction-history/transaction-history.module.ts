import { Module } from '@nestjs/common';
import { PaymentRpcService } from './payment-rpc.service';
import { TransactionHistoryRepository } from './transaction-history.repository';
import { TransactionHistoryService } from './transaction-history.service';

@Module({
  providers: [PaymentRpcService, TransactionHistoryRepository, TransactionHistoryService],
  exports: [PaymentRpcService],
})
export class TransactionHistoryModule {}
