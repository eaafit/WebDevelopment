import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { AssessmentStatus } from '@notary-portal/api-contracts';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import { Copy } from './copy';

describe('Copy', () => {
  let component: Copy;
  let fixture: ComponentFixture<Copy>;
  let documentService: { getDocument: jest.Mock };
  let assessmentService: { getAssessment: jest.Mock };

  const document = {
    id: 'document-1',
    assessmentId: 'assessment-1',
    fileName: 'copy.pdf',
    fileType: 'application/pdf',
    version: 1,
    uploadedAt: { seconds: BigInt(Math.floor(Date.now() / 1000)), nanos: 0 },
    uploadedById: 'user-1',
    downloadUrl: '/files/copy.pdf',
  };

  beforeEach(async () => {
    documentService = {
      getDocument: jest.fn().mockResolvedValue(document),
    };
    assessmentService = {
      getAssessment: jest.fn().mockResolvedValue({ id: 'assessment-1', status: AssessmentStatus.COMPLETED }),
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
        { provide: DocumentService, useValue: documentService },
        { provide: AssessmentService, useValue: assessmentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Copy);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and load the requested document', () => {
    expect(component).toBeTruthy();
    expect(documentService.getDocument).toHaveBeenCalledWith('document-1');
    expect(assessmentService.getAssessment).toHaveBeenCalledWith('assessment-1');
    expect(component.doc()).toEqual(document);
  });

  it('should map assessment statuses to copy display states', () => {
    expect(component.getMappedStatus(undefined)).toBe('pending');
    expect(component.getMappedStatus(1)).toBe('pending');
    expect(component.getMappedStatus(2)).toBe('processing');
    expect(component.getMappedStatus(4)).toBe('ready');
    expect(component.getMappedStatus(5)).toBe('delivered');
  });

  it('should navigate back to the list relative to the current route', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.goBackToList();

    expect(navigateSpy).toHaveBeenCalledWith(['../'], { relativeTo: TestBed.inject(ActivatedRoute) });
  });

  it('should show an error when the document cannot be loaded', async () => {
    documentService.getDocument.mockRejectedValueOnce(new Error('No document'));

    const nextFixture = TestBed.createComponent(Copy);
    const nextComponent = nextFixture.componentInstance;
    nextFixture.detectChanges();
    await nextFixture.whenStable();

    expect(nextComponent.hasError()).toBe(true);
  });
});
