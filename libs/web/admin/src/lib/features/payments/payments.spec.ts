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

    // Manually trigger the payments data emission
    paymentsSubject.next(MOCK_PAYMENTS.map((p) => ({ ...p })));

    // Detect changes to update the component with the new data
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

  it('should render the csv export status strip', () => {
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const strip = host.querySelector('.payments-export-strip');
    const items = host.querySelectorAll('.payments-export-strip__item');
    const dots = host.querySelectorAll('.payments-export-strip__dot');

    expect(strip).toBeTruthy();
    expect(items.length).toBe(3);
    expect(dots.length).toBe(3);
    expect(strip?.textContent).toContain(String(component.filteredPayments.length));
    expect(strip?.textContent).toContain(String(component.currentPage));
  });

  it('should keep csv export button clickable for empty selections', () => {
    component.payments = [];
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const exportButton = host.querySelector<HTMLButtonElement>('.admin-page__actions .admin-btn--primary');

    expect(component.filteredPayments.length).toBe(0);
    expect(exportButton).toBeTruthy();
    expect(exportButton?.disabled).toBe(false);
  });

  it('should render csv export errors separately from load errors', () => {
    component.loadError = 'load failed';
    component.exportError = 'export failed';
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const exportError = host.querySelector('.payments-export-error');

    expect(exportError?.textContent).toContain('export failed');
    expect(host.textContent).toContain('load failed');
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
