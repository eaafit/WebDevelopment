import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Guest } from './guest';

describe('Guest', () => {
  let component: Guest;
  let fixture: ComponentFixture<Guest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Guest],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Guest);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
