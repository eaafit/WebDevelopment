import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { New } from './new';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import { RPC_TRANSPORT } from '../../rpc/rpc-transport';

describe('New', () => {
  let component: New;
  let fixture: ComponentFixture<New>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [New],
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
          provide: AssessmentService,
          useValue: {
            listAssessments: jest.fn().mockResolvedValue({
              assesments: [],
              meta: {
                totalItems: 0,
                totalPages: 1,
                currentPage: 1,
                perPage: 1000,
              },
            }),
          },
        },
        {
          provide: DocumentService,
          useValue: {
            createDocument: jest.fn(),
          },
        },
        {
          provide: RPC_TRANSPORT,
          useValue: {
            unary: jest.fn(),
            stream: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(New);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
