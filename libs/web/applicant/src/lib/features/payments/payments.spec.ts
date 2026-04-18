import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { TransactionHistoryPage } from '@notary-portal/ui';
import { of, Subject } from 'rxjs';
import { Payments } from './payments';
import { PaymentsApiService, type PaymentsHistoryQuery } from './payments-api.service';

describe('Payments', () => {
  let component: Payments;
  let fixture: ComponentFixture<Payments>;
  let getTransactionHistory: jest.Mock;

  beforeEach(async () => {
    getTransactionHistory = jest.fn().mockImplementation((query: PaymentsHistoryQuery) =>
      of<TransactionHistoryPage>({
        transactions: [
          {
            id: `payment-page-${query.page}`,
            userId: 'user-1',
            type: 'subscription',
            status: 'completed',
            paymentDate: '2026-03-06T08:45:00.000Z',
            transactionId: `TXN-${query.page}`,
            amount: '4990.00',
            currency: 'RUB',
            description: 'Подписка Premium (30 дней)',
            paymentMethod: 'bank_card',
            hasReceipt: true,
            receiptStatus: 'available',
            attachmentFileName: 'receipt.pdf',
            attachmentFileUrl: 'https://example.local/receipt.pdf',
            subscriptionId: 'subscription-1',
            assessmentId: null,
          },
        ],
        meta: {
          totalItems: 12,
          totalPages: 2,
          currentPage: query.page,
          perPage: query.limit,
        },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [Payments],
      providers: [
        provideRouter([]),
        {
          provide: PaymentsApiService,
          useValue: {
            getTransactionHistory,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Payments);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load the first page immediately', () => {
    expect(getTransactionHistory).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      searchQuery: undefined,
      status: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
    expect(component.transactions()).toHaveLength(1);
    expect(component.meta()?.currentPage).toBe(1);
  });

  it('should request the selected page without appending transactions', async () => {
    component.onPageChange(2);
    await fixture.whenStable();

    expect(getTransactionHistory).toHaveBeenLastCalledWith({
      page: 2,
      limit: 10,
      searchQuery: undefined,
      status: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
    expect(component.transactions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'payment-page-2',
        }),
      ]),
    );
    expect(component.transactions()).toHaveLength(1);
  });

  it('should reset pagination when filters are applied', async () => {
    component.onPageChange(2);
    await fixture.whenStable();

    component.onFiltersApply({
      searchQuery: '  sbp  ',
      status: 'pending',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-06',
    });
    await fixture.whenStable();

    expect(getTransactionHistory).toHaveBeenLastCalledWith({
      page: 1,
      limit: 10,
      searchQuery: 'sbp',
      status: 'pending',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-06',
    });
  });

  it('should keep the current filters visible until the next response is ready', async () => {
    const pendingResponse = new Subject<TransactionHistoryPage>();
    getTransactionHistory.mockReturnValueOnce(pendingResponse);

    component.onFiltersApply({
      searchQuery: 'sbp',
      status: 'pending',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-06',
    });
    fixture.detectChanges();

    expect(component.loading()).toBe(true);
    expect(component.filters()).toEqual({
      searchQuery: '',
      status: 'all',
      dateFrom: '',
      dateTo: '',
    });

    pendingResponse.next({
      transactions: [],
      meta: {
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
        perPage: 10,
      },
    });
    pendingResponse.complete();
    await fixture.whenStable();

    expect(component.filters()).toEqual({
      searchQuery: 'sbp',
      status: 'pending',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-06',
    });
  });
});
