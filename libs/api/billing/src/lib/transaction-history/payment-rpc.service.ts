import {
  type CreatePaymentRequest,
  type CreatePaymentResponse,
  type CreateSubscriptionRequest,
  type CreateSubscriptionResponse,
  type GetPaymentHistoryRequest,
  type GetPaymentHistoryResponse,
  type GetSubscriptionRequest,
  type GetSubscriptionResponse,
  type ProcessWebhookRequest,
  type ProcessWebhookResponse,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';
import { PaymentCreateService } from '../payment-create/payment-create.service';
import { PaymentSubscriptionService } from '../subscription/payment-subscription.service';
import { PaymentWebhookService } from '../webhook/payment-webhook.service';
import { TransactionHistoryService } from './transaction-history.service';

@Injectable()
export class PaymentRpcService {
  constructor(
    private readonly transactionHistoryService: TransactionHistoryService,
    private readonly paymentCreateService: PaymentCreateService,
    private readonly paymentWebhookService: PaymentWebhookService,
    private readonly paymentSubscriptionService: PaymentSubscriptionService,
  ) {}

  readonly getPaymentHistory = (
    request: GetPaymentHistoryRequest,
  ): Promise<GetPaymentHistoryResponse> =>
    this.transactionHistoryService.getPaymentHistory(request);

  readonly createPayment = (request: CreatePaymentRequest): Promise<CreatePaymentResponse> =>
    this.paymentCreateService.createPayment(request);

  readonly processWebhook = (request: ProcessWebhookRequest): Promise<ProcessWebhookResponse> =>
    this.paymentWebhookService.processWebhook(request);

  readonly getSubscription = (request: GetSubscriptionRequest): Promise<GetSubscriptionResponse> =>
    this.paymentSubscriptionService.getSubscription(request);

  readonly createSubscription = (
    request: CreateSubscriptionRequest,
  ): Promise<CreateSubscriptionResponse> =>
    this.paymentSubscriptionService.createSubscription(request);
}
