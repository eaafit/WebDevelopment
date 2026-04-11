import { PaymentReceiptStatus, PaymentStatus, PaymentType } from '@internal/prisma-client';
import { PaymentWebhookError, PaymentWebhookService } from './payment-webhook.service';

describe('PaymentWebhookService', () => {
  const findPayment = jest.fn();
  const paymentUpdateMany = jest.fn();
  const promoUpdate = jest.fn();
  const transaction = jest.fn();
  const storeGeneratedReceipt = jest.fn();
  const markReceiptFailed = jest.fn();
  const metrics = {
    recordPayment: jest.fn(),
    recordPaymentAmount: jest.fn(),
  };
  const yookassa = {
    getPayment: jest.fn(),
  };
  const paymentSubscriptionService = {
    activateSubscription: jest.fn(),
  };
  const paymentAttachmentService = {
    storeGeneratedReceipt,
    markReceiptFailed,
  };
  const prisma = {
    payment: {
      findFirst: findPayment,
      updateMany: paymentUpdateMany,
    },
    promo: {
      update: promoUpdate,
    },
    $transaction: transaction,
  };

  const originalWebhookSecret = process.env['PAYMENT_WEBHOOK_SECRET'];

  beforeEach(() => {
    process.env['PAYMENT_WEBHOOK_SECRET'] = 'super-secret';

    findPayment.mockReset();
    paymentUpdateMany.mockReset();
    promoUpdate.mockReset();
    transaction.mockReset();
    storeGeneratedReceipt.mockReset();
    markReceiptFailed.mockReset();
    metrics.recordPayment.mockReset();
    metrics.recordPaymentAmount.mockReset();
    yookassa.getPayment.mockReset();
    paymentSubscriptionService.activateSubscription.mockReset();

    findPayment.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      amount: {
        toString: () => '1350.00',
      },
      status: PaymentStatus.Pending,
      type: PaymentType.Subscription,
      promoId: 'promo-1',
      subscriptionId: 'subscription-1',
      paymentMethod: 'yookassa_widget',
      transactionId: 'yk-payment-1',
      attachmentFileUrl: null,
      receiptStatus: PaymentReceiptStatus.Pending,
    });
    yookassa.getPayment.mockResolvedValue({
      id: 'yk-payment-1',
      status: 'succeeded',
      paid: true,
      amountValue: '1350.00',
      amountCurrency: 'RUB',
      paymentMethodType: 'bank_card',
      paymentMethodTitle: 'Bank card *4477',
      receiptRegistration: 'succeeded',
      createdAt: '2026-03-06T08:40:00.000Z',
      capturedAt: '2026-03-06T08:45:00.000Z',
      metadata: {
        payment_id: 'payment-1',
      },
    });
    transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback({
        payment: {
          updateMany: paymentUpdateMany,
        },
        promo: {
          update: promoUpdate,
        },
      } as never),
    );
    paymentUpdateMany.mockResolvedValue({ count: 1 });
    promoUpdate.mockResolvedValue(undefined);
    paymentSubscriptionService.activateSubscription.mockResolvedValue(undefined);
    storeGeneratedReceipt.mockResolvedValue(undefined);
    markReceiptFailed.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env['PAYMENT_WEBHOOK_SECRET'] = originalWebhookSecret;
  });

  it('should verify the webhook secret and mark subscription payments as completed once', async () => {
    const service = new PaymentWebhookService(
      prisma as never,
      metrics as never,
      yookassa as never,
      paymentSubscriptionService as never,
      paymentAttachmentService as never,
    );

    await service.handleYooKassaNotification(
      {
        type: 'notification',
        event: 'payment.succeeded',
        object: {
          id: 'yk-payment-1',
          status: 'succeeded',
        },
      },
      { signature: 'super-secret' },
    );

    expect(yookassa.getPayment).toHaveBeenCalledWith('yk-payment-1');
    expect(paymentUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment-1',
        status: PaymentStatus.Pending,
      },
      data: {
        status: PaymentStatus.Completed,
        paymentMethod: 'bank_card',
      },
    });
    expect(paymentSubscriptionService.activateSubscription).toHaveBeenCalled();
    expect(storeGeneratedReceipt).toHaveBeenCalledWith(
      'payment-1',
      expect.objectContaining({
        id: 'yk-payment-1',
        receiptRegistration: 'succeeded',
      }),
    );
    expect(promoUpdate).toHaveBeenCalledWith({
      where: { id: 'promo-1' },
      data: {
        usedCount: {
          increment: 1,
        },
      },
    });
    expect(metrics.recordPayment).toHaveBeenCalledWith('completed');
    expect(metrics.recordPaymentAmount).toHaveBeenCalledWith(1350);
  });

  it('should stay idempotent for duplicate success notifications', async () => {
    paymentUpdateMany.mockResolvedValue({ count: 0 });

    const service = new PaymentWebhookService(
      prisma as never,
      metrics as never,
      yookassa as never,
      paymentSubscriptionService as never,
      paymentAttachmentService as never,
    );

    await service.handleYooKassaNotification(
      {
        type: 'notification',
        event: 'payment.succeeded',
        object: {
          id: 'yk-payment-1',
          status: 'succeeded',
        },
      },
      { signature: 'super-secret' },
    );

    expect(paymentSubscriptionService.activateSubscription).not.toHaveBeenCalled();
    expect(promoUpdate).not.toHaveBeenCalled();
    expect(metrics.recordPayment).not.toHaveBeenCalled();
    expect(storeGeneratedReceipt).toHaveBeenCalled();
  });

  it('should reject notifications with an invalid secret', async () => {
    const service = new PaymentWebhookService(
      prisma as never,
      metrics as never,
      yookassa as never,
      paymentSubscriptionService as never,
      paymentAttachmentService as never,
    );

    await expect(
      service.handleYooKassaNotification(
        {
          type: 'notification',
          event: 'payment.succeeded',
          object: {
            id: 'yk-payment-1',
            status: 'succeeded',
          },
        },
        { signature: 'bad-secret' },
      ),
    ).rejects.toEqual(expect.objectContaining<Partial<PaymentWebhookError>>({ statusCode: 401 }));
  });
});
