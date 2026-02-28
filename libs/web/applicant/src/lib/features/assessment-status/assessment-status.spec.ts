import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssessmentStatus } from './assessment-status';

describe('AssessmentStatus', () => {
  let component: AssessmentStatus;
  let fixture: ComponentFixture<AssessmentStatus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentStatus],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentStatus);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
