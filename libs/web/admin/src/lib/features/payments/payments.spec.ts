import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { WebLoggerService, TokenStore } from '@notary-portal/ui';
import { AdminPaymentsApiService } from '../../api/admin-payments-api.service';
import { MOCK_PAYMENTS, Payment } from './payments.shared';
import { Payments } from './payments';
import { RPC_TRANSPORT } from '@notary-portal/ui';

// Mock URL for Jest environment
if (typeof global.URL === 'undefined') {
  global.URL = require('url').URL;
}

describe('Payments', () => {
  let component: Payments;
  let fixture: ComponentFixture<Payments>;
  let logger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };
  let paymentsSubject: BehaviorSubject<Payment[] | null>;

  function createMockProviders(
    paymentsStream: BehaviorSubject<Payment[] | null>,
    loggerMock: Record<string, jest.Mock>,
    deletePaymentMock: jest.Mock = jest.fn().mockResolvedValue(true),
  ) {
    return [
      provideRouter([]),
      {
        provide: Router,
        useValue: { navigate: jest.fn().mockResolvedValue(true) },
      },
      {
        provide: TokenStore,
        useValue: { getAccessToken: jest.fn(() => 'test-token') },
      },
      {
        provide: RPC_TRANSPORT,
        useValue: {},
      },
      {
        provide: AdminPaymentsApiService,
        useValue: {
          preload: () => {
            paymentsStream.next(MOCK_PAYMENTS.map((p) => ({ ...p })));
          },
          payments$: paymentsStream.asObservable(),
          getAllPayments: async () => MOCK_PAYMENTS.map((p) => ({ ...p })),
          deletePayment: deletePaymentMock,
        },
      },
      {
        provide: WebLoggerService,
        useValue: loggerMock,
      },
    ];
  }

  beforeEach(async () => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    paymentsSubject = new BehaviorSubject<Payment[] | null>(null);
    const urlCtor = globalThis.URL as typeof URL & {
      createObjectURL?: jest.Mock;
      revokeObjectURL?: jest.Mock;
    };
    urlCtor.createObjectURL = jest.fn(() => 'blob:http://localhost/fake-url');
    urlCtor.revokeObjectURL = jest.fn();

    await TestBed.configureTestingModule({
      imports: [Payments],
      providers: createMockProviders(paymentsSubject, logger),
    }).compileComponents();

    fixture = TestBed.createComponent(Payments);
    component = fixture.componentInstance;

    // Trigger ngOnInit
    fixture.detectChanges();

    // Manually trigger the payments data emission
    paymentsSubject.next(MOCK_PAYMENTS.map((p) => ({ ...p })));

    // Detect changes to update the component with the new data
    fixture.detectChanges();
  });

  afterEach(() => {
    paymentsSubject.complete();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should log list init and loaded when payments arrive', () => {
    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.list_init_started',
      expect.objectContaining({ area: 'admin_payments_list' }),
    );

    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.list_loaded',
      expect.objectContaining({
        area: 'admin_payments_list',
        total: MOCK_PAYMENTS.length,
      }),
    );
  });

  it('should log error when payments stream fails', async () => {
    const failLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const failSubject = new BehaviorSubject<Payment[] | null>(null);

    // Reset TestBed and create a fresh instance for this test
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [Payments],
      providers: [
        {
          provide: TokenStore,
          useValue: { getAccessToken: jest.fn(() => 'test-token') },
        },
        {
          provide: RPC_TRANSPORT,
          useValue: {},
        },
        {
          provide: AdminPaymentsApiService,
          useValue: {
            preload: jest.fn(),
            payments$: failSubject.asObservable(),
            getAllPayments: async () => [],
            deletePayment: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: WebLoggerService,
          useValue: failLogger,
        },
      ],
    }).compileComponents();

    const failFixture = TestBed.createComponent(Payments);
    const failComponent = failFixture.componentInstance;
    failFixture.detectChanges(); // Trigger ngOnInit

    failSubject.error(new Error('Network failure'));

    expect(failLogger.error).toHaveBeenCalledWith(
      'payment.admin.list_load_failed',
      expect.objectContaining({
        area: 'admin_payments_list',
        error: expect.any(Error),
      }),
    );
    expect(failComponent.loadError).toBeTruthy();
    failSubject.complete();
  });

  it('should log list destroyed on ngOnDestroy', () => {
    component.ngOnDestroy();

    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.list_destroyed',
      expect.objectContaining({ area: 'admin_payments_list' }),
    );
  });

  it('should log receipt open blocked when no token', async () => {
    const tokenStore = TestBed.inject(TokenStore);
    (tokenStore.getAccessToken as jest.Mock).mockReturnValue(null);

    await component.openReceipt(1001);

    expect(logger.warn).toHaveBeenCalledWith(
      'payment.admin.receipt_open_blocked_no_token',
      expect.objectContaining({
        area: 'admin_payments_list',
        paymentId: '1001',
      }),
    );
  });

  it('should log receipt download blocked when no token', async () => {
    const tokenStore = TestBed.inject(TokenStore);
    (tokenStore.getAccessToken as jest.Mock).mockReturnValue(null);

    await component.downloadReceipt(1001);

    expect(logger.warn).toHaveBeenCalledWith(
      'payment.admin.receipt_download_blocked_no_token',
      expect.objectContaining({
        area: 'admin_payments_list',
        paymentId: '1001',
      }),
    );
  });

  it('should log delete modal opened and delete requested on confirm', async () => {
    const payment = MOCK_PAYMENTS[0];

    component.openDeleteModal(payment);
    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.delete_modal_opened',
      expect.objectContaining({
        area: 'admin_payments_list',
        paymentId: String(payment.id),
      }),
    );

    await component.onDeleteConfirmed();
    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.delete_requested',
      expect.objectContaining({ paymentId: String(payment.id) }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.delete_succeeded',
      expect.objectContaining({ paymentId: String(payment.id) }),
    );
  });

  it('should log delete failed when api rejects', async () => {
    const api = TestBed.inject(AdminPaymentsApiService);
    (api.deletePayment as jest.Mock).mockRejectedValue(new Error('RPC error'));

    const payment = MOCK_PAYMENTS[0];
    component.openDeleteModal(payment);
    await component.onDeleteConfirmed();

    expect(logger.error).toHaveBeenCalledWith(
      'payment.admin.delete_failed',
      expect.objectContaining({
        area: 'admin_payments_list',
        paymentId: String(payment.id),
        error: expect.any(Error),
      }),
    );
  });

  it('should log delete cancelled', () => {
    const payment = MOCK_PAYMENTS[0];
    component.openDeleteModal(payment);
    component.onDeleteCancelled();

    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.delete_cancelled',
      expect.objectContaining({ area: 'admin_payments_list' }),
    );
  });

  it('should log edit open requested', () => {
    const payment = MOCK_PAYMENTS[0];
    component.openEditModal(payment);

    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.edit_open_requested',
      expect.objectContaining({
        area: 'admin_payments_list',
        paymentId: String(payment.id),
      }),
    );
  });

  it('should log view opened', () => {
    const payment = MOCK_PAYMENTS[0];
    component.openViewModal(payment);

    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.view_opened',
      expect.objectContaining({
        area: 'admin_payments_list',
        paymentId: String(payment.id),
      }),
    );
  });

  it('should log create form opened', () => {
    component.goToCreateForm();

    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.create_form_opened',
      expect.objectContaining({ area: 'admin_payments_list' }),
    );
  });

  it('should log export csv started and succeeded', () => {
    component.exportToCsv();

    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.export_csv_started',
      expect.objectContaining({
        area: 'admin_payments_list',
        rows: component.filteredPayments.length,
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.export_csv_succeeded',
      expect.objectContaining({
        area: 'admin_payments_list',
        rows: component.filteredPayments.length,
      }),
    );
  });

  it('should build csv content for filtered payments', () => {
    component.searchTerm = 'txn_abc123';

    const exportedText = (
      component as unknown as {
        buildCsvContent: (payments: Payment[]) => string;
      }
    ).buildCsvContent([MOCK_PAYMENTS[0]]);

    expect(exportedText).toContain('"ID";"Дата платежа";"Плательщик"');
    expect(exportedText).toContain('txn_abc123');
    expect(exportedText).not.toContain('sub_xyz789');
  });
});
