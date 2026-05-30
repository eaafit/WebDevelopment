import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import { Copy } from './copy';

describe('Copy', () => {
  let component: Copy;
  let fixture: ComponentFixture<Copy>;
  let assessmentService: { getAssessment: jest.Mock };
  let documentService: { getDocument: jest.Mock };

  beforeEach(async () => {
    assessmentService = {
      getAssessment: jest.fn().mockResolvedValue({ id: 'assessment-1', status: 4 }),
    };
    documentService = {
      getDocument: jest.fn().mockResolvedValue({
        id: 'document-1',
        assessmentId: 'assessment-1',
        fileName: 'copy.pdf',
        fileType: 'application/pdf',
        version: 1,
        uploadedById: 'user-1',
        downloadUrl: '/files/copy.pdf',
      }),
    };

    await TestBed.configureTestingModule({
      imports: [Copy],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: jest.fn().mockReturnValue('document-1'),
              },
            },
          },
        },
        { provide: AssessmentService, useValue: assessmentService },
        { provide: DocumentService, useValue: documentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Copy);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('maps assessment statuses to copy display states', () => {
    expect(component.getMappedStatus(undefined)).toBe('pending');
    expect(component.getMappedStatus(1)).toBe('pending');
    expect(component.getMappedStatus(4)).toBe('ready');
    expect(component.getMappedStatus(5)).toBe('delivered');
    expect(component.getMappedStatus(2)).toBe('processing');
  });

  it('uses a safe processing state for unknown statuses', () => {
    expect(component.getMappedStatus(999)).toBe('processing');
  });
});
