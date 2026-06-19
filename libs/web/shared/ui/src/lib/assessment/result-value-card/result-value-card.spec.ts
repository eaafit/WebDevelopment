import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResultValueCard } from './result-value-card';

describe('ResultValueCard', () => {
  let component: ResultValueCard;
  let fixture: ComponentFixture<ResultValueCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultValueCard],
    }).compileComponents();

    fixture = TestBed.createComponent(ResultValueCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
