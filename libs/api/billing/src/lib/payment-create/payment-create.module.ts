import { Module } from '@nestjs/common';
import { PaymentWebhookService } from '../webhook/payment-webhook.service';
import { YooKassaClient } from '../yookassa/yookassa.client';
import { PaymentCreateService } from './payment-create.service';

@Module({
  providers: [YooKassaClient, PaymentCreateService, PaymentWebhookService],
  exports: [PaymentCreateService, PaymentWebhookService],
})
export class PaymentCreateModule {}
