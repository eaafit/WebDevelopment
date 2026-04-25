import { StorageModule } from '@internal/storage';
import { Module } from '@nestjs/common';
import { PaymentAttachmentService } from '../payment-attachment/payment-attachment.service';
import { PaymentWebhookService } from '../webhook/payment-webhook.service';
import { PaymentSubscriptionService } from '../subscription/payment-subscription.service';
import { YooKassaClient } from '../yookassa/yookassa.client';
import { PaymentCreateService } from './payment-create.service';

@Module({
  imports: [StorageModule],
  providers: [
    YooKassaClient,
    PaymentCreateService,
    PaymentWebhookService,
    PaymentSubscriptionService,
    PaymentAttachmentService,
  ],
  exports: [
    PaymentCreateService,
    PaymentWebhookService,
    PaymentSubscriptionService,
    PaymentAttachmentService,
  ],
})
export class PaymentCreateModule {}
