import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { MetricsService } from '@internal/metrics';
import {
  PaymentStatus as PrismaPaymentStatus,
  PaymentType as PrismaPaymentType,
} from '@internal/prisma-client';

export interface YooKassaNotificationPayload {
  type: string;
  event: string;
  object: {
    id: string;
    status: string;
    [key: string]: unknown;
  };
}

@Injectable()
export class PaymentWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async handleYooKassaNotification(body: YooKassaNotificationPayload): Promise<void> {
    if (body.type !== 'notification' || !body.object?.id) {
      return;
    }

    const externalId = body.object.id;
    const event = body.event;

    const payment = await this.prisma.payment.findUnique({
      where: { transactionId: externalId },
      include: { subscription: true },
    });

    if (!payment) {
      return;
    }

    if (event === 'payment.succeeded') {
      this.metrics.recordPayment('completed');
      this.metrics.recordPaymentAmount(Number(payment.amount));
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PrismaPaymentStatus.Completed },
        });
        if (payment.type === PrismaPaymentType.Subscription && payment.subscriptionId) {
          await tx.subscription.update({
            where: { id: payment.subscriptionId },
            data: { isActive: true },
          });
        }
      });
    } else if (event === 'payment.canceled') {
      this.metrics.recordPayment('failed');
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PrismaPaymentStatus.Failed },
      });
    }
  }
}
