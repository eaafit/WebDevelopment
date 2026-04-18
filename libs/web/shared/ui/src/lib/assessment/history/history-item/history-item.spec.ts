import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistoryItemComponent } from './history-item';
import { AssessmentOrder } from '../models';

describe('HistoryItemComponent', () => {
  let component: HistoryItemComponent;
  let fixture: ComponentFixture<HistoryItemComponent>;

  const mockOrder: AssessmentOrder = {
    id: 'ORD-001',
    objectAddress: 'ул. Тестовая, д.1',
    orderDate: new Date(),
    status: 'pending',
    totalAmount: 5000,
    statusHistory: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryItemComponent],
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
});
