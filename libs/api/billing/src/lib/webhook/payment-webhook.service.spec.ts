import { Logger } from '@nestjs/common';
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
    recordBillingPayment: jest.fn(),
    recordBillingPaymentAmount: jest.fn(),
    recordPromoApplied: jest.fn(),
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
  const auditService = {
    record: jest.fn(),
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
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env['PAYMENT_WEBHOOK_SECRET'] = 'super-secret';
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    findPayment.mockReset();
    paymentUpdateMany.mockReset();
    promoUpdate.mockReset();
    transaction.mockReset();
    storeGeneratedReceipt.mockReset();
    markReceiptFailed.mockReset();
    metrics.recordPayment.mockReset();
    metrics.recordPaymentAmount.mockReset();
    metrics.recordBillingPayment.mockReset();
    metrics.recordBillingPaymentAmount.mockReset();
    metrics.recordPromoApplied.mockReset();
    yookassa.getPayment.mockReset();
    paymentSubscriptionService.activateSubscription.mockReset();
    auditService.record.mockReset();

    findPayment.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      amount: {
        toString: () => '1350.00',
      },
      status: PaymentStatus.Pending,
      type: PaymentType.Subscription,
      promoId: 'promo-1',
      discountAmount: {
        toString: () => '150.00',
      },
      subscriptionId: 'subscription-1',
      assessmentId: null,
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

  afterEach(() => {
    loggerSpy.mockRestore();
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
      auditService as never,
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
    expect(metrics.recordBillingPayment).toHaveBeenCalledWith('completed', {
      actor: 'notary',
      scenario: 'subscription',
    });
    expect(metrics.recordBillingPaymentAmount).toHaveBeenCalledWith(1350, {
      actor: 'notary',
      scenario: 'subscription',
    });
    expect(metrics.recordPromoApplied).toHaveBeenCalledWith(
      {
        actor: 'notary',
        scenario: 'subscription',
      },
      'percent',
      150,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user-1',
        eventType: 'payment.completed',
        targetType: 'Payment',
        targetId: 'payment-1',
        actionContext: 'Статус обновлён по YooKassa webhook',
        after: expect.objectContaining({
          paymentId: 'payment-1',
          status: PaymentStatus.Completed,
          amount: '1350.00',
          transactionId: 'yk-payment-1',
          paymentMethod: 'bank_card',
          paymentProvider: 'YooKassa',
        }),
      }),
    );
  });
  });

  it('should branch assessment payments into a placeholder post-payment hook', async () => {
    findPayment.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      amount: {
        toString: () => '2500.00',
      },
      status: PaymentStatus.Pending,
      type: PaymentType.Assessment,
      promoId: null,
      discountAmount: null,
      subscriptionId: null,
      assessmentId: 'assessment-1',
      paymentMethod: 'yookassa_widget',
      transactionId: 'yk-payment-1',
      attachmentFileUrl: null,
      receiptStatus: PaymentReceiptStatus.Pending,
    });
    yookassa.getPayment.mockResolvedValue({
      id: 'yk-payment-1',
      status: 'succeeded',
      paid: true,
      amountValue: '2500.00',
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

    const service = new PaymentWebhookService(
      prisma as never,
      metrics as never,
      yookassa as never,
      paymentSubscriptionService as never,
      paymentAttachmentService as never,
      auditService as never,
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
    expect(
      loggerSpy.mock.calls.some(([message]) =>
        String(message).includes('Assessment payment payment-1 completed'),
      ),
    ).toBe(true);
    expect(metrics.recordBillingPayment).toHaveBeenCalledWith('completed', {
      actor: 'applicant',
      scenario: 'assessment_service',
    });
    expect(metrics.recordBillingPaymentAmount).toHaveBeenCalledWith(2500, {
      actor: 'applicant',
      scenario: 'assessment_service',
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'payment.completed',
        targetType: 'Assessment',
        targetId: 'assessment-1',
        targetContext: 'Платёж #payment-',
        after: expect.objectContaining({
          paymentId: 'payment-1',
          assessmentId: 'assessment-1',
        }),
      })
    );
  });

  it('should branch document copy payments into a placeholder post-payment hook', async () => {
    findPayment.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      amount: {
        toString: () => '900.00',
      },
      status: PaymentStatus.Pending,
      type: PaymentType.DocumentCopy,
      promoId: null,
      discountAmount: null,
      subscriptionId: null,
      assessmentId: null,
      paymentMethod: 'yookassa_widget',
      transactionId: 'yk-payment-1',
      attachmentFileUrl: null,
      receiptStatus: PaymentReceiptStatus.Pending,
    });
    yookassa.getPayment.mockResolvedValue({
      id: 'yk-payment-1',
      status: 'succeeded',
      paid: true,
      amountValue: '900.00',
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

    const service = new PaymentWebhookService(
      prisma as never,
      metrics as never,
      yookassa as never,
      paymentSubscriptionService as never,
      paymentAttachmentService as never,
      auditService as never,
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
    expect(
      loggerSpy.mock.calls.some(([message]) =>
        String(message).includes('Document copy payment payment-1 completed'),
      ),
    ).toBe(true);
    expect(metrics.recordBillingPayment).toHaveBeenCalledWith('completed', {
      actor: 'applicant',
      scenario: 'document_copy_service',
    });
    expect(metrics.recordBillingPaymentAmount).toHaveBeenCalledWith(900, {
      actor: 'applicant',
      scenario: 'document_copy_service',
    });
  });

  it('should stay idempotent for duplicate success notifications', async () => {
    paymentUpdateMany.mockResolvedValue({ count: 0 });

    const service = new PaymentWebhookService(
      prisma as never,
      metrics as never,
      yookassa as never,
      paymentSubscriptionService as never,
      paymentAttachmentService as never,
      auditService as never,
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
    expect(metrics.recordBillingPayment).not.toHaveBeenCalled();
    expect(metrics.recordPromoApplied).not.toHaveBeenCalled();
    expect(storeGeneratedReceipt).toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('should audit canceled payments only after a real status transition', async () => {
    yookassa.getPayment.mockResolvedValue({
      id: 'yk-payment-1',
      status: 'canceled',
      paid: false,
      amountValue: '1350.00',
      amountCurrency: 'RUB',
      paymentMethodType: 'sbp',
      paymentMethodTitle: 'SBP',
      receiptRegistration: null,
      createdAt: '2026-03-06T08:40:00.000Z',
      capturedAt: null,
      metadata: {
        payment_id: 'payment-1',
      },
    });

    const service = new PaymentWebhookService(
      prisma as never,
      metrics as never,
      yookassa as never,
      paymentSubscriptionService as never,
      paymentAttachmentService as never,
      auditService as never,
    );

    await service.handleYooKassaNotification(
      {
        type: 'notification',
        event: 'payment.canceled',
        object: {
          id: 'yk-payment-1',
          status: 'canceled',
        },
      },
      { signature: 'super-secret' },
    );

    expect(paymentUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment-1',
        status: PaymentStatus.Pending,
      },
      data: {
        status: PaymentStatus.Failed,
        paymentMethod: 'sbp',
      },
    });
    expect(metrics.recordPayment).toHaveBeenCalledWith('failed');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user-1',
        eventType: 'payment.failed',
        targetType: 'Payment',
        targetId: 'payment-1',
        after: expect.objectContaining({
          paymentId: 'payment-1',
          status: PaymentStatus.Failed,
          amount: '1350.00',
          transactionId: 'yk-payment-1',
          paymentMethod: 'sbp',
          paymentProvider: 'YooKassa',
        }),
      }),
    );
  });

  it('should not audit duplicate canceled notifications', async () => {
    paymentUpdateMany.mockResolvedValue({ count: 0 });
    yookassa.getPayment.mockResolvedValue({
      id: 'yk-payment-1',
      status: 'canceled',
      paid: false,
      amountValue: '1350.00',
      amountCurrency: 'RUB',
      paymentMethodType: 'sbp',
      paymentMethodTitle: 'SBP',
      receiptRegistration: null,
      createdAt: '2026-03-06T08:40:00.000Z',
      capturedAt: null,
      metadata: {
        payment_id: 'payment-1',
      },
    });

    const service = new PaymentWebhookService(
      prisma as never,
      metrics as never,
      yookassa as never,
      paymentSubscriptionService as never,
      paymentAttachmentService as never,
      auditService as never,
    );

    await service.handleYooKassaNotification(
      {
        type: 'notification',
        event: 'payment.canceled',
        object: {
          id: 'yk-payment-1',
          status: 'canceled',
        },
      },
      { signature: 'super-secret' },
    );

    expect(metrics.recordPayment).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('should mark canceled applicant service payments as failed billing metrics', async () => {
    findPayment.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      amount: {
        toString: () => '2500.00',
      },
      status: PaymentStatus.Pending,
      type: PaymentType.Assessment,
      promoId: null,
      discountAmount: null,
      subscriptionId: null,
      assessmentId: 'assessment-1',
      paymentMethod: 'yookassa_widget',
      transactionId: 'yk-payment-1',
      attachmentFileUrl: null,
      receiptStatus: PaymentReceiptStatus.Pending,
    });
    yookassa.getPayment.mockResolvedValue({
      id: 'yk-payment-1',
      status: 'canceled',
      paid: false,
      amountValue: '2500.00',
      amountCurrency: 'RUB',
      paymentMethodType: 'bank_card',
      paymentMethodTitle: 'Bank card *4477',
      receiptRegistration: null,
      createdAt: '2026-03-06T08:40:00.000Z',
      capturedAt: null,
      metadata: {
        payment_id: 'payment-1',
      },
    });

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
        event: 'payment.canceled',
        object: {
          id: 'yk-payment-1',
          status: 'canceled',
        },
      },
      { signature: 'super-secret' },
    );

    expect(paymentUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment-1',
        status: PaymentStatus.Pending,
      },
      data: {
        status: PaymentStatus.Failed,
        paymentMethod: 'bank_card',
      },
    });
    expect(metrics.recordPayment).toHaveBeenCalledWith('failed');
    expect(metrics.recordBillingPayment).toHaveBeenCalledWith('failed', {
      actor: 'applicant',
      scenario: 'assessment_service',
    });
  });

  it('should reject notifications with an invalid secret', async () => {
    const service = new PaymentWebhookService(
      prisma as never,
      metrics as never,
      yookassa as never,
      paymentSubscriptionService as never,
      paymentAttachmentService as never,
      auditService as never,
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
