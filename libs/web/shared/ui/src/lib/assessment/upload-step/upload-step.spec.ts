import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssessmentUploadStepComponent } from './upload-step';

describe('UploadStep', () => {
  let component: AssessmentUploadStepComponent;
  let fixture: ComponentFixture<AssessmentUploadStepComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentUploadStepComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentUploadStepComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
