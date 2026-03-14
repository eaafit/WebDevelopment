import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SaleComponent } from './sale';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

describe('SaleComponent', () => {
  let component: SaleComponent;
  let fixture: ComponentFixture<SaleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, SaleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SaleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
