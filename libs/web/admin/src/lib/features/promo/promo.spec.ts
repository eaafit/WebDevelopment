import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PromoComponent } from './promo';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

describe('PromoComponent', () => {
  let component: PromoComponent;
  let fixture: ComponentFixture<PromoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, PromoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PromoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
