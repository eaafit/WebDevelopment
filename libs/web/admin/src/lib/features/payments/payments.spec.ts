import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
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
  let anchorDispatchSpy: jest.SpyInstance;

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
    anchorDispatchSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'dispatchEvent')
      .mockImplementation(() => true);

    await TestBed.configureTestingModule({
      imports: [Payments],
      providers: createMockProviders(paymentsSubject, logger),
    }).compileComponents();

    fixture = TestBed.createComponent(Payments);
    component = fixture.componentInstance;

    // Trigger ngOnInit
    fixture.detectChanges();

    fixture.detectChanges();
  });

  afterEach(() => {
    anchorClickSpy.mockRestore();
    anchorDispatchSpy.mockRestore();
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

  it('should reload the first page when admin changes page size', () => {
    component.currentPage = 3;

    component.onPageSizeChanged(50);

    expect(component.pageSize).toBe(50);
    expect(component.currentPage).toBe(1);
    expect(listPaymentsMock).toHaveBeenLastCalledWith({
      page: 1,
      limit: 50,
      statuses: [],
      types: [],
      searchQuery: undefined,
    });
  });

  it('should show total payments from server metadata instead of current page length', () => {
    listPaymentsMock.mockReturnValueOnce(
      of({
        payments: MOCK_PAYMENTS.slice(0, 1).map((p) => ({ ...p })),
        meta: {
          currentPage: 1,
          totalItems: 42,
          totalPages: 5,
          limit: 20,
        },
      }),
    );

    component.onPageSizeChanged(20);

    expect(component.payments).toHaveLength(1);
    expect(component.totalItems).toBe(42);
    expect(component.totalPages).toBe(5);
  });

  it('uses compact default table widths and lets admins resize columns', () => {
    expect(component.getColumnWidth('id')).toBe(68);

    component.startColumnResize(
      'id',
      new MouseEvent('mousedown', {
        clientX: 100,
      }),
    );
    component.onDocumentMouseMove(
      new MouseEvent('mousemove', {
        clientX: 132,
      }),
    );
    component.onDocumentMouseUp();

    expect(component.getColumnWidth('id')).toBe(100);
  });

  it('should log error when paged payment loading fails', async () => {
    const failLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

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
            payments$: new BehaviorSubject<Payment[] | null>(null).asObservable(),
            listPayments: jest.fn(() => throwError(() => new Error('Network failure'))),
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

    expect(failLogger.error).toHaveBeenCalledWith(
      'payment.admin.list_load_failed',
      expect.objectContaining({
        area: 'admin_payments_list',
        error: expect.any(Error),
      }),
    );
    expect(failComponent.loadError).toBeTruthy();
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

  it('should navigate to existing admin orders route from the applications shortcut', () => {
    const router = TestBed.inject(Router);

    component.goToApplications();

    expect(router.navigate).toHaveBeenCalledWith(['/admin', 'orders'], undefined);
    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.navigate_applications',
      expect.objectContaining({
        area: 'admin_payments_list',
        paymentId: null,
        assessmentId: null,
      }),
    );
  });

  it('should preserve assessment id when opening the linked order list', () => {
    const router = TestBed.inject(Router);

    component.goToApplication('assessment-42');

    expect(router.navigate).toHaveBeenCalledWith(['/admin', 'orders'], {
      queryParams: { assessmentId: 'assessment-42' },
    });
    expect(logger.info).toHaveBeenCalledWith(
      'payment.admin.navigate_application',
      expect.objectContaining({
        area: 'admin_payments_list',
        assessmentId: 'assessment-42',
      }),
    );
  });

  it('should log export csv started and succeeded', () => {
    component.exportToCsv();

    expect(getAllPaymentsMock).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(anchorDispatchSpy).toHaveBeenCalledWith(expect.any(MouseEvent));
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

  it('should show csv export error when current selection is empty', () => {
    component.payments = [];

    component.exportToCsv();

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(anchorDispatchSpy).not.toHaveBeenCalled();
    expect(component.exportError).toBe('No payments in current selection for CSV export');
    expect(logger.warn).toHaveBeenCalledWith(
      'payment.admin.export_csv_skipped_empty',
      expect.objectContaining({ area: 'admin_payments_list' }),
    );
  });

  it('should keep the page interactive when csv download fails', () => {
    const urlCtor = globalThis.URL as typeof URL & {
      createObjectURL?: jest.Mock;
    };
    urlCtor.createObjectURL?.mockImplementationOnce(() => {
      throw new Error('Blob URL blocked');
    });

    component.exportToCsv();

    expect(component.exporting).toBe(false);
    expect(component.exportError).toBe('Blob URL blocked');
    expect(logger.error).toHaveBeenCalledWith(
      'payment.admin.export_csv_failed',
      expect.objectContaining({
        area: 'admin_payments_list',
        error: expect.any(Error),
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
