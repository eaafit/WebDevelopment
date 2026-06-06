import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { AssessmentHistoryComponent } from './assessment-history';
import { OrderApiService } from '../order-api.service';
import { TokenStore } from '../../rpc/token-store';

describe('AssessmentHistoryComponent', () => {
  let component: AssessmentHistoryComponent;
  let fixture: ComponentFixture<AssessmentHistoryComponent>;
  let orderApiService: { listOrders: jest.Mock };

  beforeEach(async () => {
    orderApiService = {
      listOrders: jest.fn().mockResolvedValue({ orders: [], totalPages: 1 }),
    };

    await TestBed.configureTestingModule({
      imports: [AssessmentHistoryComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {},
            },
          },
        },
        {
          provide: TokenStore,
          useValue: {
            user: jest.fn().mockReturnValue({ id: 'user-1' }),
            role: jest.fn().mockReturnValue(1),
          },
        },
        { provide: OrderApiService, useValue: orderApiService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and request applicant orders for the current user', () => {
    expect(component).toBeTruthy();
    expect(orderApiService.listOrders).toHaveBeenCalledWith({
      userId: 'user-1',
      role: 'applicant',
      status: undefined,
      search: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      page: 1,
      pageSize: 5,
    });
  });

  it('should navigate to the new assessment form with repeated order data', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.orders.set([
      {
        id: 'ORD-001',
        objectAddress: 'Main street, 10',
        realEstateObject: {
          area: 42,
          objectType: 1,
          roomsCount: 2,
          floor: 3,
        },
      },
    ]);

    await component.repeatOrder('ORD-001');

    expect(navigateSpy).toHaveBeenCalledWith(['/applicant/assessment/new/params'], {
      state: {
        repeatOrderData: expect.objectContaining({
          address: 'Main street, 10',
          area: '42',
          objectType: '1',
          rooms: '2',
          floor: '3',
        }),
      },
    });
  });

  it('should report a missing order without navigation', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    await component.repeatOrder('ORD-404');

    expect(errorSpy).toHaveBeenCalledWith('Order not found');
    expect(navigateSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
