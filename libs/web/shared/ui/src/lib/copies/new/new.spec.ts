import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RPC_TRANSPORT } from '../../rpc/rpc-transport';
import { TokenStore } from '../../rpc/token-store';
import { AssessmentService } from '../services/assesment.service';
import { DocumentService } from '../services/document.service';
import { New } from './new';

describe('New', () => {
  let component: New;
  let fixture: ComponentFixture<New>;
  let assessmentService: { listAssessments: jest.Mock };
  let documentService: { createDocument: jest.Mock };

  beforeEach(async () => {
    assessmentService = {
      listAssessments: jest.fn().mockResolvedValue({ assesments: [] }),
    };
    documentService = {
      createDocument: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [New],
      providers: [
        provideRouter([]),
        { provide: RPC_TRANSPORT, useValue: {} },
        { provide: TokenStore, useValue: { user: () => ({ id: 'auth-user-1' }) } },
        { provide: AssessmentService, useValue: assessmentService },
        { provide: DocumentService, useValue: documentService },
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

  it('resolves current user id from the authenticated user (TokenStore)', () => {
    expect(component.getCurrentUserId()).toBe('auth-user-1');
  });
});
