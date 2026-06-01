import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssessmentHistoryComponent } from './assessment-history';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderApiService } from '../order-api.service';
import { TokenStore } from '../../rpc/token-store';

describe('AssessmentHistoryComponent', () => {
  let component: AssessmentHistoryComponent;
  let fixture: ComponentFixture<AssessmentHistoryComponent>;
  let router: { navigate: jest.Mock };

  beforeEach(async () => {
    router = { navigate: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [AssessmentHistoryComponent],
      providers: [
        {
          provide: OrderApiService,
          useValue: {
            listOrders: jest.fn().mockResolvedValue({
              orders: [],
              totalCount: 0,
              totalPages: 1,
            }),
            takeOrder: jest.fn(),
          },
        },
        {
          provide: TokenStore,
          useValue: {
            user: jest.fn(() => ({ id: 'user-1' })),
            role: jest.fn(() => 1),
          },
        },
        {
          provide: Router,
          useValue: router,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {},
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // it('should filter orders by search query', () => {
  //   component.searchQuery.set('Тверская');
  //   fixture.detectChanges();
  //   expect(component.filteredOrders.length).toBe(1);
  //   expect(component.filteredOrders[0].objectAddress).toContain('Тверская');
  // });

  // it('should filter by status', () => {
  //   component.statusFilter.set('completed');
  //   fixture.detectChanges();
  //   expect(component.filteredOrders.every((o) => o.status === 'completed')).toBe(true);
  // });

  it('should navigate with repeat order data', () => {
    component.orders.set([
      {
        id: 'ORD-001',
        objectAddress: 'Test address',
        status: 'created',
        realEstateObject: {
          area: 42,
          objectType: 'flat',
          roomsCount: 2,
          floor: 3,
        },
      },
    ]);

    component.repeatOrder('ORD-001');
    expect(router.navigate).toHaveBeenCalledWith(['/applicant/assessment/new/params'], {
      state: expect.objectContaining({
        repeatOrderData: expect.objectContaining({
          address: 'Test address',
          area: '42',
        }),
      }),
    });
  });
});
