import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TokenStore } from '@notary-portal/ui';
import { Checkout } from './checkout';
import { SubscriptionCheckoutApiService } from './subscription-checkout-api.service';
import { YooKassaWidgetService, type YooKassaWidgetHandlers } from './yookassa-widget.service';

type CheckoutTestApi = Checkout & {
  applyPromo: () => Promise<void>;
  promoInput: {
    set: (value: string) => void;
  };
  startPayment: () => Promise<void>;
  state: () => string;
  displayAmount: () => string;
  errorMessage: () => string;
};

describe('Checkout', () => {
  let component: Checkout;
  let checkout: CheckoutTestApi;
  let fixture: ComponentFixture<Checkout>;
  let checkoutApi: {
    createSubscriptionDraft: jest.Mock;
    createPayment: jest.Mock;
    validateSubscriptionPromo: jest.Mock;
    waitForPaymentStatus: jest.Mock;
  };
  let widgetHandlers: YooKassaWidgetHandlers | undefined;
  let widgetService: {
    mount: jest.Mock;
  };

  beforeEach(async () => {
    checkoutApi = {
      createSubscriptionDraft: jest.fn().mockResolvedValue('subscription-1'),
      createPayment: jest.fn().mockResolvedValue({
        paymentId: 'payment-1',
        widget: {
          confirmationToken: 'confirmation-token',
          returnUrl:
            'https://example.local/notary/subscription/checkout/success?paymentId=payment-1',
        },
        amount: {
          amount: '1350.00',
          currency: 'RUB',
        },
      }),
      validateSubscriptionPromo: jest.fn().mockResolvedValue({
        status: 'valid',
        promoCode: 'SPRING10',
        baseAmount: '1500.00',
        finalAmount: '1350.00',
        discountAmount: '150.00',
        discountPercent: '10.00',
      }),
      waitForPaymentStatus: jest.fn().mockResolvedValue('completed'),
    };

    widgetHandlers = undefined;
    widgetService = {
      mount: jest
        .fn()
        .mockImplementation(
          async (
            _containerId: string,
            _confirmationToken: string,
            handlers: YooKassaWidgetHandlers,
          ) => {
            widgetHandlers = handlers;
            return { destroy: jest.fn() };
          },
        ),
    };

    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [
        provideRouter([]),
        {
          provide: TokenStore,
          useValue: {
            user: signal({
              id: 'user-1',
              email: 'notary@example.com',
              fullName: 'Test Notary',
              role: 2,
              phoneNumber: '',
              isActive: true,
            }).asReadonly(),
          },
        },
        {
          provide: SubscriptionCheckoutApiService,
          useValue: checkoutApi,
        },
        {
          provide: YooKassaWidgetService,
          useValue: widgetService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Checkout);
    component = fixture.componentInstance;
    checkout = component as CheckoutTestApi;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should create a payment and mount the YooKassa widget', async () => {
    await checkout.startPayment();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(checkoutApi.createSubscriptionDraft).toHaveBeenCalledWith({
      userId: 'user-1',
      planCode: 'basic',
    });
    expect(checkoutApi.createPayment).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: '1500.00',
      subscriptionId: 'subscription-1',
      promoCode: '',
    });
    expect(widgetService.mount).toHaveBeenCalledWith(
      'yookassa-widget-host',
      'confirmation-token',
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onFail: expect.any(Function),
      }),
    );
    expect(checkout.state()).toBe('widget');
    expect(checkout.displayAmount()).toBe('1350.00');
    expect(element.querySelector('.widget-stage')).not.toBeNull();
    expect(element.querySelector('.grid-checkout')).toBeNull();
    expect(element.querySelector('.widget-card')).toBeNull();
  });

  it('should validate promo and update the checkout summary before payment', async () => {
    checkout.promoInput.set('SPRING10');
    await checkout.applyPromo();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(checkoutApi.validateSubscriptionPromo).toHaveBeenCalledWith({
      planCode: 'basic',
      promoCode: 'SPRING10',
    });
    expect(checkout.displayAmount()).toBe('1350.00');
    expect(element.querySelector('.promo-feedback.is-success')).not.toBeNull();
    expect(element.textContent).toContain('Промокод применён.');
    expect(element.textContent).toContain('SPRING10');
  });

  it('should show an inline error for an invalid promo code', async () => {
    checkoutApi.validateSubscriptionPromo.mockResolvedValue({
      status: 'not_found',
      promoCode: 'NOPE',
      baseAmount: '1500.00',
      finalAmount: '1500.00',
      discountAmount: '0.00',
      discountPercent: '0.00',
    });

    checkout.promoInput.set('NOPE');
    await checkout.applyPromo();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(checkout.state()).toBe('ready');
    expect(element.querySelector('.promo-feedback.is-error')).not.toBeNull();
    expect(element.querySelector('.error-card')).toBeNull();
    expect(element.textContent).toContain('Такой промокод не найден. Проверьте написание.');
  });

  it('should require promo application before starting payment', async () => {
    checkout.promoInput.set('SPRING10');

    await checkout.startPayment();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(checkoutApi.createSubscriptionDraft).not.toHaveBeenCalled();
    expect(element.querySelector('.promo-feedback.is-error')).not.toBeNull();
    expect(element.textContent).toContain('Промокод ещё не применён.');
  });

  it('should switch to the success state after widget success and confirmed webhook status', async () => {
    await checkout.startPayment();
    await widgetHandlers?.onSuccess();
    fixture.detectChanges();

    expect(checkoutApi.waitForPaymentStatus).toHaveBeenCalledWith({
      userId: 'user-1',
      paymentId: 'payment-1',
    });
    expect(checkout.state()).toBe('success');
    expect((fixture.nativeElement as HTMLElement).querySelector('.success-card')).not.toBeNull();
  });

  it('should show a user-friendly error card without exposing raw technical details', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    checkoutApi.createPayment.mockRejectedValue(new Error('connect ETIMEDOUT 10.0.0.1'));

    await checkout.startPayment();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(checkout.state()).toBe('error');
    expect(element.querySelector('.error-card')).not.toBeNull();
    expect(element.textContent).toContain('Не получилось открыть оплату');
    expect(element.textContent).toContain(
      'Мы не смогли подготовить платёж. Попробуйте ещё раз через несколько секунд.',
    );
    expect(element.textContent).not.toContain('ETIMEDOUT');

    consoleErrorSpy.mockRestore();
  });

  it('should keep processing UI inside widget stage without a duplicate notice banner', async () => {
    checkoutApi.waitForPaymentStatus.mockResolvedValue('pending');

    await checkout.startPayment();
    await widgetHandlers?.onSuccess();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(checkout.state()).toBe('processing');
    expect(element.querySelector('.widget-stage.is-processing')).not.toBeNull();
    expect(element.querySelector('.notice-banner')).toBeNull();
    expect(element.textContent).toContain('Проверяем подтверждение платежа');
  });

  it('should show a retryable cancelled state when the widget is closed', async () => {
    await checkout.startPayment();
    widgetHandlers?.onClose();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(checkout.state()).toBe('cancelled');
    expect(checkout.errorMessage()).toContain('Виджет оплаты закрыт');
    expect(element.querySelector('.grid-checkout')).not.toBeNull();
    expect(element.querySelector('.widget-stage')).toBeNull();
    expect(element.querySelector('.cancel-card')).not.toBeNull();
  });
});
