import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssessmentHistoryComponent } from './assessment-history';
import { By } from '@angular/platform-browser';

describe('AssessmentHistoryComponent', () => {
  let component: AssessmentHistoryComponent;
  let fixture: ComponentFixture<AssessmentHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentHistoryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter orders by search query', () => {
    component.searchQuery.set('Тверская');
    fixture.detectChanges();
    expect(component.filteredOrders.length).toBe(1);
    expect(component.filteredOrders[0].objectAddress).toContain('Тверская');
  });

  it('should filter by status', () => {
    component.statusFilter.set('completed');
    fixture.detectChanges();
    expect(component.filteredOrders.every((o) => o.status === 'completed')).toBe(true);
  });

  it('should emit repeat order action', () => {
    const spy = jest.spyOn(console, 'log');
    component.repeatOrder('ORD-001');
    expect(spy).toHaveBeenCalledWith('Повтор заказа ORD-001 для роли applicant');
  });
});
