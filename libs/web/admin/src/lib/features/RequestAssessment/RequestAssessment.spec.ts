import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RequestAssessment } from './RequestAssessment';

describe('RequestAssessment', () => {
  let component: RequestAssessment;
  let fixture: ComponentFixture<RequestAssessment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestAssessment],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestAssessment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
