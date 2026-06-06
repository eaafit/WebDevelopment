import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AssessmentResultsApiService } from '../assessment-results-api.service';
import { EstimationFormSessionService } from '../../../estimation-form/estimation-form-session.service';
import { AssessmentResultsComponent } from './results-list';

describe('AssessmentResultsComponent', () => {
  let component: AssessmentResultsComponent;
  let fixture: ComponentFixture<AssessmentResultsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentResultsComponent],
      providers: [
        provideRouter([]),
        {
          provide: AssessmentResultsApiService,
          useValue: {
            listCompletedAssessments: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: EstimationFormSessionService,
          useValue: {
            ensureUserId: jest.fn().mockResolvedValue('user-1'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentResultsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
