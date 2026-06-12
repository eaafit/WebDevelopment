import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AssessmentApiService } from '../estimation-form/assessment-api.service';
import { EstimationFormLocalDraftService } from '../estimation-form/estimation-form-local-draft.service';
import { EstimationFormSessionService } from '../estimation-form/estimation-form-session.service';
import { AssessmentStatus } from './assessment-status';

describe('AssessmentStatus', () => {
  let component: AssessmentStatus;
  let fixture: ComponentFixture<AssessmentStatus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentStatus],
      providers: [
        provideRouter([]),
        {
          provide: AssessmentApiService,
          useValue: {
            getAssessment: jest.fn(),
            logApplicantAssessmentAction: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EstimationFormSessionService,
          useValue: {
            ensureUserId: jest.fn().mockResolvedValue('user-1'),
          },
        },
        {
          provide: EstimationFormLocalDraftService,
          useValue: {
            clear: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentStatus);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
