import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { RPC_TRANSPORT } from '../../rpc/rpc-transport';
import { TokenStore } from '../../rpc/token-store';
import { Document, DocumentService } from '../services/document.service';
import { List } from './list';

describe('List', () => {
  let component: List;
  let fixture: ComponentFixture<List>;
  let documentService: { listDocumentsByAssessment: jest.Mock };

  const documents: Document[] = [
    {
      id: 'doc-1',
      assessmentId: 'assessment-1',
      fileName: 'purchase-contract.pdf',
      fileType: 'application/pdf',
      version: 1,
      uploadedAt: { seconds: BigInt(Math.floor(new Date('2026-05-10').getTime() / 1000)), nanos: 0 },
      uploadedById: 'user-1',
      downloadUrl: '/files/purchase-contract.pdf',
    },
    {
      id: 'doc-2',
      assessmentId: 'assessment-2',
      fileName: 'ownership-certificate.pdf',
      fileType: 'application/pdf',
      version: 1,
      uploadedAt: { seconds: BigInt(Math.floor(new Date('2026-05-20').getTime() / 1000)), nanos: 0 },
      uploadedById: 'user-1',
      downloadUrl: '/files/ownership-certificate.pdf',
    },
  ];

  beforeEach(async () => {
    documentService = {
      listDocumentsByAssessment: jest.fn().mockResolvedValue({ documents }),
    };

    await TestBed.configureTestingModule({
      imports: [List],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { role: 'notary' },
            },
          },
        },
        { provide: DocumentService, useValue: documentService },
        { provide: RPC_TRANSPORT, useValue: {} },
        { provide: TokenStore, useValue: { user: () => ({ id: 'applicant-1' }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(List);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and resolve the role from route data', () => {
    expect(component).toBeTruthy();
    expect(component.role).toBe('notary');
  });

  it('should load documents', async () => {
    await component.fetchDocuments();

    expect(documentService.listDocumentsByAssessment).toHaveBeenCalledWith(undefined, {
      page: 1,
      limit: 1000,
    });
    expect(component.rawDocuments()).toEqual(documents);
  });

  it('should filter documents by file name and upload date', () => {
    component.rawDocuments.set(documents);

    component.appliedFilters.set({
      fileName: 'ownership',
      assessmentId: '',
      dateFrom: '2026-05-19',
      dateTo: '2026-05-21',
    });

    expect(component.filteredDocuments()).toEqual([documents[1]]);
  });

  it('should reset the current page when the page size changes', () => {
    component.rawDocuments.set(documents);
    component.page.set(2);

    component.changeLimit(1);

    expect(component.limit()).toBe(1);
    expect(component.page()).toBe(1);
    expect(component.totalPages()).toBe(2);
  });

  it('should navigate to the create copy route relative to the list route', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.navigateToNew();

    expect(navigateSpy).toHaveBeenCalledWith(['new'], { relativeTo: TestBed.inject(ActivatedRoute) });
  });
});
