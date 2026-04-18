import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { PaymentType } from '@notary-portal/api-contracts';
import { TokenStore } from '@notary-portal/ui';
import { Checkout } from './checkout';
import { CheckoutApiService } from './checkout-api.service';
import { YooKassaWidgetService, type YooKassaWidgetHandlers } from './yookassa-widget.service';

type CheckoutTestApi = Checkout & {
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
    createPayment: jest.Mock;
    waitForPaymentStatus: jest.Mock;
  };
  let widgetHandlers: YooKassaWidgetHandlers | undefined;
  let widgetService: {
    mount: jest.Mock;
  };

  beforeEach(async () => {
    checkoutApi = {
      createPayment: jest.fn().mockResolvedValue({
        paymentId: 'payment-1',
        widget: {
          confirmationToken: 'confirmation-token',
          returnUrl: 'https://example.local/applicant/checkout/success?paymentId=payment-1',
        },
        amount: {
          amount: '2500.00',
          currency: 'RUB',
        },
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
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                type: 'assessment',
                assessmentId: 'assessment-1',
                amount: '2500.00',
              }),
              routeConfig: { path: 'checkout' },
            },
          },
        },
        {
          provide: TokenStore,
          useValue: {
            user: signal({
              id: 'user-1',
              email: 'applicant@example.com',
              fullName: 'Test Applicant',
              role: 1,
              phoneNumber: '',
              isActive: true,
            }).asReadonly(),
          },
        },
        {
          provide: CheckoutApiService,
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

  it('should hide internal service metadata on the initial checkout screen', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Услуга');
    expect(text).toContain('Сводка заказа');
    expect(text).not.toContain('1. Услуга');
    expect(text).not.toContain('Тип платежа');
    expect(text).not.toContain('ID оценки');
    expect(text).not.toContain('2. Защищённая оплата');
  });

  it('should create an assessment payment and mount the YooKassa widget', async () => {
    await checkout.startPayment();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(checkoutApi.createPayment).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: '2500.00',
      type: PaymentType.ASSESSMENT,
      targetId: 'assessment-1',
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
    expect(checkout.displayAmount()).toBe('2500.00');
    expect(element.querySelector('.widget-stage')).not.toBeNull();
  });

  it('should block payment start when the service target is missing', async () => {
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                type: 'assessment',
                amount: '2500.00',
              }),
              routeConfig: { path: 'checkout' },
            },
          },
        },
        {
          provide: TokenStore,
          useValue: {
            user: signal({
              id: 'user-1',
              email: 'applicant@example.com',
              fullName: 'Test Applicant',
              role: 1,
              phoneNumber: '',
              isActive: true,
            }).asReadonly(),
          },
        },
        {
          provide: CheckoutApiService,
          useValue: checkoutApi,
        },
        {
          provide: YooKassaWidgetService,
          useValue: widgetService,
        },
      ],
    }).compileComponents();

    const localFixture = TestBed.createComponent(Checkout);
    const localCheckout = localFixture.componentInstance as CheckoutTestApi;
    localFixture.detectChanges();
    await localFixture.whenStable();

    await localCheckout.startPayment();
    localFixture.detectChanges();

    expect(checkoutApi.createPayment).not.toHaveBeenCalled();
    expect(localCheckout.state()).toBe('error');
    expect(localCheckout.errorMessage()).toContain('не хватает идентификатора заказа');
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

  it('should create a document copy payment when the checkout type is document_copy', async () => {
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                type: 'document_copy',
                documentId: 'document-request-1',
                amount: '900.00',
              }),
              routeConfig: { path: 'checkout' },
            },
          },
        },
        {
          provide: TokenStore,
          useValue: {
            user: signal({
              id: 'user-1',
              email: 'applicant@example.com',
              fullName: 'Test Applicant',
              role: 1,
              phoneNumber: '',
              isActive: true,
            }).asReadonly(),
          },
        },
        {
          provide: CheckoutApiService,
          useValue: checkoutApi,
        },
        {
          provide: YooKassaWidgetService,
          useValue: widgetService,
        },
      ],
    }).compileComponents();

    const localFixture = TestBed.createComponent(Checkout);
    const localCheckout = localFixture.componentInstance as CheckoutTestApi;
    localFixture.detectChanges();
    await localFixture.whenStable();

    await localCheckout.startPayment();

    expect(checkoutApi.createPayment).toHaveBeenLastCalledWith({
      userId: 'user-1',
      amount: '900.00',
      type: PaymentType.DOCUMENT_COPY,
      targetId: 'document-request-1',
    });
  });
});
