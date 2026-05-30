import { AuditModule } from '@internal/audit';
import { NotificationModule } from '@internal/notification';
import { StorageModule } from '@internal/storage';
import { Module } from '@nestjs/common';
import { PaymentNotificationService } from '../payment-notification.service';
import { PaymentAttachmentService } from '../payment-attachment/payment-attachment.service';
import { PaymentWebhookService } from '../webhook/payment-webhook.service';
import { PaymentSubscriptionService } from '../subscription/payment-subscription.service';
import { RobokassaClient } from '../robokassa/robokassa.client';
import { YooKassaClient } from '../yookassa/yookassa.client';
import { PaymentCreateService } from './payment-create.service';

@Module({
  imports: [StorageModule, AuditModule, NotificationModule],
  providers: [
    YooKassaClient,
    RobokassaClient,
    PaymentCreateService,
    PaymentWebhookService,
    PaymentSubscriptionService,
    PaymentAttachmentService,
    PaymentNotificationService,
  ],
  exports: [
    PaymentCreateService,
    PaymentWebhookService,
    PaymentSubscriptionService,
    PaymentAttachmentService,
    PaymentNotificationService,
  ],
})
export class PaymentCreateModule {}
