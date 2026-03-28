import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { TransactionHistoryPage } from '@notary-portal/ui';
import { of } from 'rxjs';
import { AdminPayments } from './payments';
import { AdminPaymentsApiService, type AdminPaymentsHistoryQuery } from './payments-api.service';

describe('AdminPayments', () => {
  let component: AdminPayments;
  let fixture: ComponentFixture<AdminPayments>;
  let getPaymentHistory: jest.Mock;

  beforeEach(async () => {
    getPaymentHistory = jest.fn().mockImplementation((query: AdminPaymentsHistoryQuery) =>
      of<TransactionHistoryPage>({
        transactions: [
          {
            id: `payment-${query.page}`,
            userId: '550e8400-e29b-41d4-a716-446655440000',
            type: 'subscription',
            status: 'completed',
            paymentDate: '2026-03-06T08:45:00.000Z',
            transactionId: `TXN-${query.page}`,
            amount: '4990.00',
            currency: 'RUB',
            description: 'Подписка',
            paymentMethod: 'bank_card',
            attachmentFileName: null,
            attachmentFileUrl: null,
            subscriptionId: 'subscription-1',
            assessmentId: null,
          },
        ],
        meta: {
          totalItems: 3,
          totalPages: 1,
          currentPage: query.page,
          perPage: query.limit,
        },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [AdminPayments],
      providers: [
        provideRouter([]),
        {
          provide: AdminPaymentsApiService,
          useValue: { getPaymentHistory },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPayments);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load payments via API', () => {
    expect(getPaymentHistory).toHaveBeenCalled();
    expect(component.transactions().length).toBeGreaterThan(0);
  });
});
