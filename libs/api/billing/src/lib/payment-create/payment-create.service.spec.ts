import { create } from '@bufbuild/protobuf';
import { Code } from '@connectrpc/connect';
import {
  CreatePaymentRequestSchema,
  PaymentType,
  PromoValidationStatus,
  SubscriptionPlan,
  ValidateSubscriptionPromoRequestSchema,
} from '@notary-portal/api-contracts';
import {
  PaymentReceiptStatus,
  PaymentStatus,
  SubscriptionPlan as PrismaSubscriptionPlan,
} from '@internal/prisma-client';
import { PaymentCreateService } from './payment-create.service';

describe('PaymentCreateService', () => {
  const createPaymentRecord = jest.fn();
  const updatePaymentRecord = jest.fn();
  const findPromo = jest.fn();
  const findUser = jest.fn();
  const metrics = {
    recordPayment: jest.fn(),
  };
  const yookassa = {
    createPayment: jest.fn(),
  };
  const paymentSubscriptionService = {
    resolveSubscriptionForPayment: jest.fn(),
  };
  const auditService = {
    record: jest.fn(),
  };
  const prisma = {
    payment: {
      create: createPaymentRecord,
      update: updatePaymentRecord,
    },
    promo: {
      findFirst: findPromo,
    },
    user: {
      findUnique: findUser,
    },
  };

  const originalReturnUrl = process.env['PAYMENT_RETURN_URL_BASE'];
  const originalReceiptVatCode = process.env['YOOKASSA_RECEIPT_VAT_CODE'];

  beforeEach(() => {
    process.env['PAYMENT_RETURN_URL_BASE'] = 'https://portal.example.com';
    process.env['YOOKASSA_RECEIPT_VAT_CODE'] = '4';

    createPaymentRecord.mockReset();
    updatePaymentRecord.mockReset();
    findPromo.mockReset();
    findUser.mockReset();
    metrics.recordPayment.mockReset();
    yookassa.createPayment.mockReset();
    paymentSubscriptionService.resolveSubscriptionForPayment.mockReset();
    auditService.record.mockReset();

    paymentSubscriptionService.resolveSubscriptionForPayment.mockResolvedValue({
      id: 'subscription-1',
      userId: 'user-1',
      plan: PrismaSubscriptionPlan.Basic,
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
    findUser.mockResolvedValue({
      email: 'notary@example.com',
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
      receiptRegistration: 'pending',
    });
  });

  afterAll(() => {
    process.env['PAYMENT_RETURN_URL_BASE'] = originalReturnUrl;
    process.env['YOOKASSA_RECEIPT_VAT_CODE'] = originalReceiptVatCode;
  });

  it('should create a pending payment and return YooKassa widget init data', async () => {
    const service = new PaymentCreateService(
      prisma as never,
      yookassa as never,
      metrics as never,
      paymentSubscriptionService as never,
      auditService as never,
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
        receiptStatus: PaymentReceiptStatus.Pending,
      }),
    });
    expect(yookassa.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '1350.00',
        confirmationType: 'embedded',
        receipt: expect.objectContaining({
          customer: {
            email: 'notary@example.com',
          },
          items: [
            expect.objectContaining({
              vatCode: 4,
            }),
          ],
        }),
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
    expect(yookassa.createPayment.mock.calls[0][0].receipt).not.toHaveProperty('timezone');
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('should fail before payment creation when YOOKASSA_RECEIPT_VAT_CODE is missing', async () => {
    delete process.env['YOOKASSA_RECEIPT_VAT_CODE'];

    const service = new PaymentCreateService(
      prisma as never,
      yookassa as never,
      metrics as never,
      paymentSubscriptionService as never,
      auditService as never,
    );

    const request = create(CreatePaymentRequestSchema, {
      userId: 'user-1',
      amount: '1500.00',
      type: PaymentType.SUBSCRIPTION,
      targetId: 'subscription-1',
    });

    await expect(service.createPayment(request)).rejects.toEqual(
      expect.objectContaining({
        code: Code.FailedPrecondition,
      }),
    );

    expect(createPaymentRecord).not.toHaveBeenCalled();
    expect(yookassa.createPayment).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('should validate a subscription promo and return discounted preview data', async () => {
    const service = new PaymentCreateService(
      prisma as never,
      yookassa as never,
      metrics as never,
      paymentSubscriptionService as never,
      auditService as never,
    );

    const request = create(ValidateSubscriptionPromoRequestSchema, {
      plan: SubscriptionPlan.BASIC,
      promoCode: 'spring10',
    });

    const response = await service.validateSubscriptionPromo(request);

    expect(response).toEqual(
      expect.objectContaining({
        status: PromoValidationStatus.VALID,
        promoCode: 'SPRING10',
        baseAmount: expect.objectContaining({
          amount: '1500.00',
          currency: 'RUB',
        }),
        finalAmount: expect.objectContaining({
          amount: '1350.00',
          currency: 'RUB',
        }),
        discountAmount: expect.objectContaining({
          amount: '150.00',
          currency: 'RUB',
        }),
        discountPercent: '10.00',
      }),
    );
  });

  it('should record audit event for assessment payment creation', async () => {
    const service = new PaymentCreateService(
      prisma as never,
      yookassa as never,
      metrics as never,
      paymentSubscriptionService as never,
      auditService as never,
    );

    const request = create(CreatePaymentRequestSchema, {
      userId: 'user-1',
      amount: '2500.00',
      type: PaymentType.ASSESSMENT,
      targetId: 'assessment-1',
    });

    await service.createPayment(request);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'payment.created',
        targetType: 'Payment',
        targetId: 'payment-1',
        assessmentId: 'assessment-1',
      }),
    );
  });
});
