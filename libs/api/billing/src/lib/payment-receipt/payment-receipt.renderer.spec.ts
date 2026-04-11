import { PaymentType, SubscriptionPlan } from '@internal/prisma-client';
import { renderStoredPaymentReceipt } from './payment-receipt.renderer';

describe('payment receipt renderer', () => {
  it('renders receipt html from an external template file', () => {
    const result = renderStoredPaymentReceipt({
      payment: {
        id: 'payment-1',
        userId: 'user-1',
        type: PaymentType.Subscription,
        paymentDate: new Date('2026-04-11T09:30:00.000Z'),
        paymentMethod: 'yookassa_widget',
        transactionId: 'transaction-1',
        amount: '1500.00',
      },
      user: {
        email: 'notary@example.com',
        fullName: 'Иван <Петров>',
      },
      subscription: {
        plan: SubscriptionPlan.Premium,
      },
      assessment: null,
      providerPayment: {
        id: 'yookassa-1',
        status: 'succeeded',
        paid: true,
        amountValue: '1500.00',
        amountCurrency: 'RUB',
        paymentMethodType: 'bank_card',
        paymentMethodTitle: 'mir',
        receiptRegistration: 'succeeded',
        createdAt: '2026-04-11T09:30:00.000Z',
        capturedAt: '2026-04-11T09:35:00.000Z',
        metadata: {},
      },
    }).toString('utf8');

    expect(result).toContain('<!doctype html>');
    expect(result).toContain('Сохранить в PDF');
    expect(result).toContain('Подписка Premium');
    expect(result).toContain('Иван &lt;Петров&gt;');
    expect(result).not.toContain('Иван <Петров>');
    expect(result).toMatch(/1.?500,00/);
  });
});
