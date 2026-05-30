import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { DocumentApiService } from '../../../../../../applicant/src/lib/features/estimation-form/document-api.service';
import { AssessmentService } from '../services/assesment.service';
import { New } from './new';

describe('New', () => {
  let component: New;
  let fixture: ComponentFixture<New>;
  let assessmentService: { listAssessments: jest.Mock };
  let documentApiService: { uploadDocument: jest.Mock };

  beforeEach(async () => {
    assessmentService = {
      listAssessments: jest.fn().mockResolvedValue({ assesments: [] }),
    };
    documentApiService = {
      uploadDocument: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [New],
      providers: [
        provideRouter([]),
        { provide: RPC_TRANSPORT, useValue: {} },
        { provide: AssessmentService, useValue: assessmentService },
        { provide: DocumentApiService, useValue: documentApiService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(New);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('derives the document copy price from the selected type', () => {
    expect(component.price()).toBe(150);

    component.selectedDocType.set(3);

    expect(component.price()).toBe(500);
  });

  it('resolves current user id from the selected assessment applicant fields', () => {
    component.assesments.set([
      {
        id: 'assessment-1',
        applicantId: 'applicant-1',
      },
    ]);
    component.selectedAssesmentID.set('assessment-1');

    expect(component.getCurrentUserId()).toBe('applicant-1');
  });
});
