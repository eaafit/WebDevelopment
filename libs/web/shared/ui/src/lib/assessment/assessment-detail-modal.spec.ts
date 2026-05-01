import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssessmentDetailModal } from './assessment-detail-modal';

describe('AssessmentDetailModal', () => {
  let component: AssessmentDetailModal;
  let fixture: ComponentFixture<AssessmentDetailModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentDetailModal],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentDetailModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
