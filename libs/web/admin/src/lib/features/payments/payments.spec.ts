import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
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
  let listPaymentsMock: jest.Mock;
  let getAllPaymentsMock: jest.Mock;
  let anchorClickSpy: jest.SpyInstance;

  function createMockProviders(
    paymentsStream: BehaviorSubject<Payment[] | null>,
    loggerMock: Record<string, jest.Mock>,
    deletePaymentMock: jest.Mock = jest.fn().mockResolvedValue(true),
  ) {
    const listPayments =
      listPaymentsMock ??
      jest.fn(() =>
        of({
          payments: MOCK_PAYMENTS.map((p) => ({ ...p })),
          meta: {
            currentPage: 1,
            totalItems: MOCK_PAYMENTS.length,
            totalPages: 1,
            limit: 10,
          },
        }),
      );

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
          listPayments,
          getAllPayments:
            getAllPaymentsMock ?? jest.fn().mockResolvedValue(MOCK_PAYMENTS.map((p) => ({ ...p }))),
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
    listPaymentsMock = jest.fn(() =>
      of({
        payments: MOCK_PAYMENTS.map((p) => ({ ...p })),
        meta: {
          currentPage: 1,
          totalItems: MOCK_PAYMENTS.length,
          totalPages: 1,
          limit: 10,
        },
      }),
    );
    getAllPaymentsMock = jest.fn().mockResolvedValue(MOCK_PAYMENTS.map((p) => ({ ...p })));
    const urlCtor = globalThis.URL as typeof URL & {
      createObjectURL?: jest.Mock;
      revokeObjectURL?: jest.Mock;
    };
    urlCtor.createObjectURL = jest.fn(() => 'blob:http://localhost/fake-url');
    urlCtor.revokeObjectURL = jest.fn();
    anchorClickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation();

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
    anchorClickSpy.mockRestore();
    paymentsSubject.complete();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('CRUD — просмотр (список)', () => {
    it('should open view modal with selected payment', () => {
      const payment = MOCK_PAYMENTS[0];

      component.openViewModal(payment);

      expect(component.isViewModalOpen).toBe(true);
      expect(component.currentPayment.id).toBe(payment.id);
      expect(component.currentPayment.amount).toBe(payment.amount);
    });

    it('should close view modal on closeModals', () => {
      component.openViewModal(MOCK_PAYMENTS[0]);
      component.closeModals();

      expect(component.isViewModalOpen).toBe(false);
      expect(component.paymentToDelete).toBeNull();
    });
  });

  describe('CRUD — создание', () => {
    it('should navigate to create form route', () => {
      const router = TestBed.inject(Router);

      component.goToCreateForm();

      expect(router.navigate).toHaveBeenCalledWith(['/admin', 'payments', 'new']);
    });
  });

  describe('CRUD — редактирование', () => {
    it('should navigate to edit form route', () => {
      const router = TestBed.inject(Router);
      const payment = MOCK_PAYMENTS[0];

      component.openEditModal(payment);

      expect(router.navigate).toHaveBeenCalledWith([
        '/admin',
        'payments',
        payment.id,
        'edit',
      ]);
    });

    it('should navigate from view modal to edit form', () => {
      const router = TestBed.inject(Router);
      component.openViewModal(MOCK_PAYMENTS[0]);

      component.savePayment();

      expect(router.navigate).toHaveBeenCalledWith([
        '/admin',
        'payments',
        MOCK_PAYMENTS[0].id,
        'edit',
      ]);
      expect(component.isViewModalOpen).toBe(false);
    });
  });

  describe('CRUD — удаление', () => {
    it('should call api and remove payment from list on confirm', async () => {
      const api = TestBed.inject(AdminPaymentsApiService);
      const payment = MOCK_PAYMENTS[0];
      const initialCount = component.payments.length;

      component.openDeleteModal(payment);
      expect(component.paymentToDelete?.id).toBe(payment.id);

      await component.onDeleteConfirmed();

      expect(api.deletePayment).toHaveBeenCalledWith(String(payment.id));
      expect(component.payments).toHaveLength(initialCount - 1);
      expect(component.payments.find((p) => p.id === payment.id)).toBeUndefined();
      expect(component.paymentToDelete).toBeNull();
    });

    it('should clear delete target on cancel', () => {
      component.openDeleteModal(MOCK_PAYMENTS[0]);
      component.onDeleteCancelled();

      expect(component.paymentToDelete).toBeNull();
    });
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

  it('should load payments on initial page open', () => {
    expect(listPaymentsMock).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      statuses: [],
      types: [],
      searchQuery: undefined,
    });
    expect(component.payments).toHaveLength(MOCK_PAYMENTS.length);
    expect(component.loading).toBe(false);
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
            listPayments: jest.fn(() =>
              of({
                payments: [],
                meta: {
                  currentPage: 1,
                  totalItems: 0,
                  totalPages: 1,
                  limit: 10,
                },
              }),
            ),
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

  it('should log export csv started and succeeded', () => {
    component.exportToCsv();

    expect(getAllPaymentsMock).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(anchorClickSpy).toHaveBeenCalled();
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
        rows: MOCK_PAYMENTS.length,
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
