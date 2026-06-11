import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssessmentUploadStepComponent } from './upload-step';

describe('AssessmentUploadStepComponent', () => {
  let component: AssessmentUploadStepComponent;
  let fixture: ComponentFixture<AssessmentUploadStepComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentUploadStepComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentUploadStepComponent);
    component = fixture.componentInstance;
    component.assessmentId = 'assessment-1';
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });
});
