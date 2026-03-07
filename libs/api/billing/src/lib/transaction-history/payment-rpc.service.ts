import {
  type GetPaymentHistoryRequest,
  type GetPaymentHistoryResponse,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHistoryService } from './transaction-history.service';

@Injectable()
export class PaymentRpcService {
  constructor(private readonly transactionHistoryService: TransactionHistoryService) {}

  readonly getPaymentHistory = (
    request: GetPaymentHistoryRequest,
  ): Promise<GetPaymentHistoryResponse> =>
    this.transactionHistoryService.getPaymentHistory(request);
}
