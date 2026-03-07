import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { TransactionHistoryQuery } from '@notary-portal/api-contracts';
import { of } from 'rxjs';
import { Transactions } from './transactions';
import { TransactionsApiService } from './transactions-api.service';

describe('Transactions', () => {
  let component: Transactions;
  let fixture: ComponentFixture<Transactions>;
  let getTransactionHistory: jest.Mock;

  beforeEach(async () => {
    getTransactionHistory = jest.fn().mockImplementation((query: TransactionHistoryQuery) =>
      of({
        transactions: [
          {
            id: `payment-page-${query.page ?? 1}`,
            userId: 'user-1',
            type: 'subscription',
            status: 'completed',
            paymentDate: '2026-03-06T08:45:00.000Z',
            transactionId: `TXN-${query.page ?? 1}`,
            amount: '4990.00',
            currency: 'RUB',
            description: 'Подписка Premium (30 дней)',
            paymentMethod: 'bank_card',
            attachmentFileName: 'receipt.pdf',
            attachmentFileUrl: 'https://example.local/receipt.pdf',
            subscriptionId: 'subscription-1',
            assessmentId: null,
          },
        ],
        meta: {
          totalItems: 12,
          totalPages: 2,
          currentPage: query.page ?? 1,
          perPage: query.limit ?? 10,
        },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [Transactions],
      providers: [
        provideRouter([]),
        {
          provide: TransactionsApiService,
          useValue: {
            getTransactionHistory,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Transactions);
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
      statuses: undefined,
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
      statuses: undefined,
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
      statuses: ['pending'],
      dateFrom: '2026-03-01',
      dateTo: '2026-03-06',
    });
  });
});
