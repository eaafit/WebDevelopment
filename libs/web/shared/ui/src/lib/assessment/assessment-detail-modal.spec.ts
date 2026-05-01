import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssessmentDetailModalComponent } from './assessment-detail-modal';
import { AssessmentOrder } from './history/models';

describe('AssessmentDetailModalComponent', () => {
  let component: AssessmentDetailModalComponent;
  let fixture: ComponentFixture<AssessmentDetailModalComponent>;

  const mockOrder: AssessmentOrder = {
    id: 'ORD-001',
    objectAddress: 'ул. Тестовая, 1',
    orderDate: new Date(),
    status: 'pending',
    totalAmount: 5000,
    statusHistory: [],
    applicantId: 'user-1',
    applicantName: 'Тестов Тест',
    plannedCompletionDate: new Date(),
    realEstateObject: {
      id: 're-1',
      address: 'ул. Тестовая, 1',
      city: 'Москва',
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentDetailModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentDetailModalComponent);
    component = fixture.componentInstance;
    component.order = mockOrder;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit close event when closeModal is called', () => {
    jest.spyOn(component.close, 'emit');
    component.closeModal();
    expect(component.close.emit).toHaveBeenCalled();
  });

  it('should close on backdrop click if target is backdrop', () => {
    const event = { target: {}, currentTarget: {} } as MouseEvent;
    jest.spyOn(component, 'closeModal');
    component.onBackdropClick(event);
    expect(component.closeModal).toHaveBeenCalled();
  });

  it('should NOT close on backdrop click if target is not backdrop', () => {
    const event = { target: { tagName: 'BUTTON' }, currentTarget: {} } as any;
    jest.spyOn(component, 'closeModal');
    component.onBackdropClick(event);
    expect(component.closeModal).not.toHaveBeenCalled();
  });
});