import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RequestsComponent } from './requests';

describe('RequestsComponent', () => {
  let component: RequestsComponent;
  let fixture: ComponentFixture<RequestsComponent>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [RequestsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should seed active notary options from localStorage users', () => {
    expect(component.notaryOptions.length).toBeGreaterThan(0);
    for (const option of component.notaryOptions) {
      expect(option.id).toBeTruthy();
      expect(option.label).toBeTruthy();
    }
  });

  it('should assign notaryId to seeded Verified and InProgress assessments', () => {
    const notaryIds = component.notaryOptions.map((option) => option.id);
    const assigned = component.assessments.filter(
      (assessment) => assessment.status === 'Verified' || assessment.status === 'InProgress',
    );

    expect(assigned.length).toBeGreaterThan(0);
    for (const assessment of assigned) {
      expect(assessment.notaryId).toBeTruthy();
      expect(notaryIds).toContain(assessment.notaryId as string);
    }
  });

  it('should block confirmVerify when no notary is selected', () => {
    const target = component.assessments.find((assessment) => assessment.status === 'New');
    if (!target) {
      throw new Error('Expected at least one seeded assessment in "New" status');
    }

    component.openVerifyModal(target);
    component.notaryId = '';

    component.confirmVerify();

    expect(component.notaryIdError).toBe('Выберите нотариуса');
    expect(target.status).toBe('New');
  });

  it('should narrow filteredAssessments by createdAt range', () => {
    const total = component.assessments.length;
    component.dateFrom = '2024-03-01';
    component.dateTo = '2024-03-31';

    component.applyFilters();

    expect(component.filteredAssessments.length).toBeLessThanOrEqual(total);
    for (const assessment of component.filteredAssessments) {
      const day = assessment.createdAt.slice(0, 10);
      expect(day >= '2024-03-01').toBe(true);
      expect(day <= '2024-03-31').toBe(true);
    }
  });

  it('should narrow filteredAssessments by selected notaryId', () => {
    const withNotary = component.assessments.find((assessment) => !!assessment.notaryId);
    if (!withNotary || !withNotary.notaryId) {
      throw new Error('Expected at least one seeded assessment with a notaryId');
    }

    component.notaryFilter = withNotary.notaryId;
    component.applyFilters();

    expect(component.filteredAssessments.length).toBeGreaterThan(0);
    for (const assessment of component.filteredAssessments) {
      expect(assessment.notaryId).toBe(withNotary.notaryId);
    }
  });

  it('should clear date range and notary filter on resetTopFilters', () => {
    component.dateFrom = '2024-03-01';
    component.dateTo = '2024-03-31';
    component.notaryFilter = component.notaryOptions[0]?.id ?? '';

    component.resetTopFilters();

    expect(component.dateFrom).toBe('');
    expect(component.dateTo).toBe('');
    expect(component.notaryFilter).toBe('');
    expect(component.filteredAssessments.length).toBe(component.assessments.length);
  });
});
