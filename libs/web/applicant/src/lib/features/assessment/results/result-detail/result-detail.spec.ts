import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AssessmentStatus } from '@notary-portal/api-contracts';
import { AssessmentResultsApiService } from '../assessment-results-api.service';
import { ReportApiService } from '../report-api.service';
import { AssessmentResultDetailComponent } from './result-detail';

describe('AssessmentResultDetailComponent', () => {
  let component: AssessmentResultDetailComponent;
  let fixture: ComponentFixture<AssessmentResultDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentResultDetailComponent],
      providers: [
        provideRouter([{ path: 'applicant/assessment/results/:assessmentId', component: AssessmentResultDetailComponent }]),
        {
          provide: AssessmentResultsApiService,
          useValue: {
            getAssessmentResult: jest.fn().mockResolvedValue({
              id: 'assessment-1',
              address: 'г. Москва, ул. Тверская, 1',
              propertyType: 'Квартира',
              area: '75',
              estimatedValue: 8_500_000,
              assessedAt: '2024-03-15T10:00:00.000Z',
              status: AssessmentStatus.COMPLETED,
            }),
          },
        },
        {
          provide: ReportApiService,
          useValue: {
            listAssessmentReports: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentResultDetailComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
