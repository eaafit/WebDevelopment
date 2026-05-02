import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UploadStep } from './upload-step';

describe('UploadStep', () => {
  let component: UploadStep;
  let fixture: ComponentFixture<UploadStep>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadStep],
    }).compileComponents();

    fixture = TestBed.createComponent(UploadStep);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
