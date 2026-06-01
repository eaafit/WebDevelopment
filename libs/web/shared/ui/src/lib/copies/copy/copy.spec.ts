import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { AssessmentStatus } from '@notary-portal/api-contracts';
import { Copy } from './copy';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';

describe('Copy', () => {
  let component: Copy;
  let fixture: ComponentFixture<Copy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Copy],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: jest.fn(() => 'doc-1'),
              },
            },
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: jest.fn(),
          },
        },
        {
          provide: DocumentService,
          useValue: {
            getDocument: jest.fn().mockResolvedValue({
              id: 'doc-1',
              assessmentId: 'assessment-1',
              fileName: 'copy.pdf',
              fileType: 'application/pdf',
              version: 1,
              uploadedAt: { seconds: BigInt(Math.floor(Date.now() / 1000)), nanos: 0 },
              uploadedById: 'user-1',
              downloadUrl: '/files/copy.pdf',
            }),
          },
        },
        {
          provide: AssessmentService,
          useValue: {
            getAssessment: jest.fn().mockResolvedValue({
              id: 'assessment-1',
              status: AssessmentStatus.COMPLETED,
            }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Copy);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
