import { create } from '@bufbuild/protobuf';
import { CreatePaymentRequestSchema, PaymentType } from '@notary-portal/api-contracts';
import { PaymentStatus, SubscriptionPlan } from '@internal/prisma-client';
import { PaymentCreateService } from './payment-create.service';

describe('PaymentCreateService', () => {
  const createPaymentRecord = jest.fn();
  const updatePaymentRecord = jest.fn();
  const findPromo = jest.fn();
  const metrics = {
    recordPayment: jest.fn(),
  };
  const yookassa = {
    createPayment: jest.fn(),
  };
  const paymentSubscriptionService = {
    resolveSubscriptionForPayment: jest.fn(),
  };
  const prisma = {
    payment: {
      create: createPaymentRecord,
      update: updatePaymentRecord,
    },
    promo: {
      findFirst: findPromo,
    },
  };

  const originalReturnUrl = process.env['PAYMENT_RETURN_URL_BASE'];

  beforeEach(() => {
    process.env['PAYMENT_RETURN_URL_BASE'] = 'https://portal.example.com';

    createPaymentRecord.mockReset();
    updatePaymentRecord.mockReset();
    findPromo.mockReset();
    metrics.recordPayment.mockReset();
    yookassa.createPayment.mockReset();
    paymentSubscriptionService.resolveSubscriptionForPayment.mockReset();

    paymentSubscriptionService.resolveSubscriptionForPayment.mockResolvedValue({
      id: 'subscription-1',
      userId: 'user-1',
      plan: SubscriptionPlan.Basic,
      basePrice: {
        toString: () => '1500.00',
      },
      isActive: false,
    });
    findPromo.mockResolvedValue({
      id: 'promo-1',
      code: 'SPRING10',
      discountPercent: {
        toString: () => '10.00',
      },
      usageLimit: 10,
      usedCount: 0,
      expiresAt: null,
    });
    createPaymentRecord.mockResolvedValue({
      id: 'payment-1',
    });
    updatePaymentRecord.mockResolvedValue(undefined);
    yookassa.createPayment.mockResolvedValue({
      id: 'yk-payment-1',
      confirmationUrl: null,
      confirmationToken: 'confirmation-token-1',
      status: 'pending',
    });
  });

  afterAll(() => {
    process.env['PAYMENT_RETURN_URL_BASE'] = originalReturnUrl;
  });

  it('should create a pending payment and return YooKassa widget init data', async () => {
    const service = new PaymentCreateService(
      prisma as never,
      yookassa as never,
      metrics as never,
      paymentSubscriptionService as never,
    );

    const request = create(CreatePaymentRequestSchema, {
      userId: 'user-1',
      amount: '1500.00',
      type: PaymentType.SUBSCRIPTION,
      targetId: 'subscription-1',
      promoCode: 'SPRING10',
    });

    const response = await service.createPayment(request);

    expect(createPaymentRecord).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        amount: '1350.00',
        discountAmount: '150.00',
        promoId: 'promo-1',
        status: PaymentStatus.Pending,
        subscriptionId: 'subscription-1',
        paymentMethod: 'yookassa_widget',
      }),
    });
    expect(yookassa.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '1350.00',
        confirmationType: 'embedded',
        metadata: expect.objectContaining({
          payment_id: 'payment-1',
          target_id: 'subscription-1',
          promo_code: 'SPRING10',
        }),
      }),
    );
    expect(updatePaymentRecord).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { transactionId: 'yk-payment-1' },
    });
    expect(response).toEqual(
      expect.objectContaining({
        paymentId: 'payment-1',
        widget: expect.objectContaining({
          provider: 'yookassa',
          confirmationToken: 'confirmation-token-1',
          returnUrl:
            'https://portal.example.com/notary/subscription/checkout/success?paymentId=payment-1',
        }),
        amount: expect.objectContaining({
          amount: '1350.00',
          currency: 'RUB',
        }),
      }),
    );
    expect(metrics.recordPayment).toHaveBeenCalledWith('pending');
  });
});
