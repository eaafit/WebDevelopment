import { Module } from '@nestjs/common';
import { PaymentWebhookService } from '../webhook/payment-webhook.service';
import { PaymentSubscriptionService } from '../subscription/payment-subscription.service';
import { YooKassaClient } from '../yookassa/yookassa.client';
import { PaymentCreateService } from './payment-create.service';

@Module({
  providers: [
    YooKassaClient,
    PaymentCreateService,
    PaymentWebhookService,
    PaymentSubscriptionService,
  ],
  exports: [PaymentCreateService, PaymentWebhookService, PaymentSubscriptionService],
})
export class PaymentCreateModule {}
