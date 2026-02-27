import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EstimationForm } from './estimation-form';

describe('EstimationForm', () => {
  let component: EstimationForm;
  let fixture: ComponentFixture<EstimationForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstimationForm],
    }).compileComponents();

    fixture = TestBed.createComponent(EstimationForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
