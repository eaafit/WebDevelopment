import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminPaymentsApiService } from '../../api/admin-payments-api.service';
import { Payment } from './payments.shared';
import { Payments } from './payments';
import { RPC_TRANSPORT } from '@notary-portal/ui';

describe('Payments', () => {
  let component: Payments;
  let fixture: ComponentFixture<Payments>;
  let listPayments: jest.Mock;
  let getAllPayments: jest.Mock;

  const paymentsFixture: Payment[] = [
    {
      id: 'payment-1',
      userId: 'user-1',
      paymentDate: '2026-03-06T08:45:00.000Z',
      payer: 'user-1',
      amount: 12500,
      currency: 'RUB',
      fee: 0,
      status: 'completed',
      statusText: 'Завершен',
      type: 'Assessment',
      assessmentId: 'assessment-1',
      paymentMethod: 'bank_card',
      transactionId: 'txn_abc123',
      attachmentFileName: 'check_1001.pdf',
      attachmentFileUrl: '/receipts/check_1001.pdf',
    },
    {
      id: 'payment-2',
      userId: 'user-2',
      paymentDate: '2026-03-05T10:15:00.000Z',
      payer: 'user-2',
      amount: 5400.5,
      currency: 'RUB',
      fee: 0,
      status: 'pending',
      statusText: 'В обработке',
      type: 'Subscription',
      subscriptionId: 'sub_xyz789',
      paymentMethod: 'invoice',
    },
  ];

  beforeEach(async () => {
    listPayments = jest.fn().mockReturnValue(
      of({
        payments: paymentsFixture.map((payment) => ({ ...payment })),
        meta: {
          totalItems: paymentsFixture.length,
          totalPages: 1,
          currentPage: 1,
          perPage: 7,
        },
      }),
    );
    getAllPayments = jest
      .fn()
      .mockResolvedValue(paymentsFixture.map((payment) => ({ ...payment })));

    await TestBed.configureTestingModule({
      imports: [Payments],
      providers: [
        provideRouter([]),
        {
          provide: RPC_TRANSPORT,
          useValue: {},
        },
        {
          provide: AdminPaymentsApiService,
          useValue: {
            listPayments,
            getAllPayments,
            deletePayment: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Payments);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load payments from API with server pagination', () => {
    expect(listPayments).toHaveBeenCalledWith({
      page: 1,
      limit: 7,
      searchQuery: undefined,
      statuses: [],
      types: [],
    });
    expect(component.payments).toHaveLength(2);
    expect(component.totalPages).toBe(1);
  });

  it('should build csv content for filtered payments', () => {
    component.searchTerm = 'txn_abc123';

    const exportedText = (
      component as unknown as {
        buildCsvContent: (payments: Payment[]) => string;
      }
    ).buildCsvContent([paymentsFixture[0]]);

    expect(exportedText).toContain('"ID";"Дата платежа";"Плательщик"');
    expect(exportedText).toContain('txn_abc123');
    expect(exportedText).not.toContain('sub_xyz789');
  });
});
