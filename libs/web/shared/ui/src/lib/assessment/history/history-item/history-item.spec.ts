import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistoryItemComponent } from './history-item';
import { AssessmentOrder } from '../models';
import { OrderApiService } from '../../order-api.service';

describe('HistoryItemComponent', () => {
  let component: HistoryItemComponent;
  let fixture: ComponentFixture<HistoryItemComponent>;
  let orderApiService: { takeOrder: jest.Mock };

  const mockOrder: AssessmentOrder = {
    id: 'ORD-001',
    assessmentId: 'assessment-1',
    objectAddress: 'Test street, 1',
    orderDate: new Date(),
    status: 'created',
    totalAmount: 5000,
    statusHistory: [],
    applicantId: 'applicant-1',
    applicantName: 'Applicant',
    plannedCompletionDate: new Date(),
    realEstateObject: {
      id: 'object-1',
      address: 'Test street, 1',
    },
  };

  beforeEach(async () => {
    orderApiService = {
      takeOrder: jest.fn().mockResolvedValue(mockOrder),
    };

    await TestBed.configureTestingModule({
      imports: [HistoryItemComponent],
      providers: [{ provide: OrderApiService, useValue: orderApiService }],
    }).compileComponents();

    fixture = TestBed.createComponent(HistoryItemComponent);
    component = fixture.componentInstance;
    component.order = mockOrder;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit repeat event when button clicked', () => {
    jest.spyOn(component.repeat, 'emit');
    component.onRepeat();
    expect(component.repeat.emit).toHaveBeenCalledWith('ORD-001');
  });

  it('should take available notary order and emit the update', async () => {
    component.role = 'notary';
    component.currentUserId = 'notary-1';
    jest.spyOn(component.orderTaken, 'emit');

    await component.onTakeWork();

    expect(orderApiService.takeOrder).toHaveBeenCalledWith('ORD-001', 'notary-1');
    expect(component.orderTaken.emit).toHaveBeenCalledWith('ORD-001');
  });
});
