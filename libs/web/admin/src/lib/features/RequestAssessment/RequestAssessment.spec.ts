import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RequestAssessment } from './RequestAssessment';

describe('RequestAssessment', () => {
  let component: RequestAssessment;
  let fixture: ComponentFixture<RequestAssessment>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [RequestAssessment],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestAssessment);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should anchor filter dropdown to the trigger rect when opened', () => {
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () =>
      ({
        top: 50,
        bottom: 72,
        left: 120,
        right: 142,
        width: 22,
        height: 22,
        x: 120,
        y: 50,
      }) as DOMRect;
    const event = {
      stopPropagation: () => undefined,
      currentTarget: trigger,
    } as unknown as MouseEvent;

    component.toggleColumnFilter('fullName', event);

    expect(component.activeFilterColumn).toBe('fullName');
    expect(component.filterDropdownStyle).not.toBeNull();
    expect(component.filterDropdownStyle?.top).toBe(76);
    expect(component.filterDropdownStyle?.left).toBe(120);
  });

  it('should reset filter position and active column on closeColumnFilter', () => {
    component.activeFilterColumn = 'fullName';
    component.filterDropdownStyle = { top: 10, left: 20 };

    component.closeColumnFilter();

    expect(component.activeFilterColumn).toBeNull();
    expect(component.filterDropdownStyle).toBeNull();
  });
});
