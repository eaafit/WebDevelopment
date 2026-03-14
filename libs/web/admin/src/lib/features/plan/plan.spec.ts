import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanComponent } from './plan';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

describe('PlanComponent', () => {
  let component: PlanComponent;
  let fixture: ComponentFixture<PlanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        FormsModule,
        PlanComponent, // сам компонент standalone
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
