import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { List } from './list';
import { DocumentService, Document } from '../services/document.service';
import { AssessmentService } from '../services/assesment.service';

describe('List', () => {
  let component: List;
  let fixture: ComponentFixture<List>;
  let documentService: { listDocumentsByAssessment: jest.Mock };
  let assessmentService: { getAssessment: jest.Mock };

  const documents: Document[] = [
    {
      id: 'doc-1',
      assessmentId: 'assessment-1',
      fileName: 'Passport copy.pdf',
      fileType: 'application/pdf',
      version: 1,
      uploadedAt: { seconds: 1704888000n, nanos: 0 },
      uploadedById: 'user-1',
      downloadUrl: '/files/doc-1',
    },
    {
      id: 'doc-2',
      assessmentId: 'assessment-2',
      fileName: 'Contract scan.pdf',
      fileType: 'application/pdf',
      version: 1,
      uploadedAt: { seconds: 1705752000n, nanos: 0 },
      uploadedById: 'user-1',
      downloadUrl: '/files/doc-2',
    },
  ];

  beforeEach(async () => {
    documentService = {
      listDocumentsByAssessment: jest.fn().mockResolvedValue({ documents }),
    };
    assessmentService = {
      getAssessment: jest.fn().mockImplementation((id: string) => Promise.resolve({
        id,
        status: id === 'assessment-1' ? 4 : 5,
      })),
    };

    await TestBed.configureTestingModule({
      imports: [List],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {
                role: 'notary',
              },
            },
          },
        },
        { provide: DocumentService, useValue: documentService },
        { provide: AssessmentService, useValue: assessmentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(List);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should take the role from route data', () => {
    expect(component.role).toBe('notary');
  });

  it('should load documents and cache assessment statuses', async () => {
    await component.fetchDocuments();

    expect(documentService.listDocumentsByAssessment).toHaveBeenCalledWith(undefined, {
      page: 1,
      limit: 1000,
    });
    expect(component.rawDocuments()).toEqual(documents);
    expect(component.assessmentStatuses()).toEqual({
      'assessment-1': 4,
      'assessment-2': 5,
    });
    expect(component.loading()).toBe(false);
  });

  it('should pass selected assessment id when fetching documents', async () => {
    component.appliedFilters.set({
      fileName: '',
      assessmentId: ' assessment-1 ',
      dateFrom: '',
      dateTo: '',
    });

    await component.fetchDocuments();

    expect(documentService.listDocumentsByAssessment).toHaveBeenCalledWith('assessment-1', {
      page: 1,
      limit: 1000,
    });
  });

  it('should filter documents by name and upload date', () => {
    component.rawDocuments.set(documents);
    component.appliedFilters.set({
      fileName: 'passport',
      assessmentId: '',
      dateFrom: '2024-01-10',
      dateTo: '2024-01-10',
    });

    expect(component.filteredDocuments().map((doc) => doc.id)).toEqual(['doc-1']);
  });

  it('should reset pagination when page size changes', () => {
    component.rawDocuments.set(documents);
    component.page.set(2);

    component.changeLimit(20);

    expect(component.limit()).toBe(20);
    expect(component.page()).toBe(1);
  });

  it('should navigate to the new copy form relative to the current route', () => {
    const router = TestBed.inject(Router);
    const route = TestBed.inject(ActivatedRoute);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.navigateToNew();

    expect(navigateSpy).toHaveBeenCalledWith(['new'], { relativeTo: route });
  });
});
