import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { List } from './list';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';

describe('List', () => {
  let component: List;
  let fixture: ComponentFixture<List>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [List],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {},
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
            listDocumentsByAssessment: jest.fn().mockResolvedValue({
              documents: [],
              meta: {
                totalItems: 0,
                totalPages: 1,
                currentPage: 1,
                perPage: 9,
              },
            }),
          },
        },
        {
          provide: AssessmentService,
          useValue: {
            getAssessment: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(List);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
