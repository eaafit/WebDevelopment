import {
  type CreatePaymentRequest,
  type CreatePaymentResponse,
  type GetPaymentHistoryRequest,
  type GetPaymentHistoryResponse,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';
import { PaymentCreateService } from '../payment-create/payment-create.service';
import { TransactionHistoryService } from './transaction-history.service';

@Injectable()
export class PaymentRpcService {
  constructor(
    private readonly transactionHistoryService: TransactionHistoryService,
    private readonly paymentCreateService: PaymentCreateService,
  ) {}

  readonly getPaymentHistory = (
    request: GetPaymentHistoryRequest,
  ): Promise<GetPaymentHistoryResponse> =>
    this.transactionHistoryService.getPaymentHistory(request);

  readonly createPayment = (request: CreatePaymentRequest): Promise<CreatePaymentResponse> =>
    this.paymentCreateService.createPayment(request);
}
