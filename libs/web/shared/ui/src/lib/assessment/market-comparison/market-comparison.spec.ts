import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarketComparison } from './market-comparison';

describe('MarketComparison', () => {
  let component: MarketComparison;
  let fixture: ComponentFixture<MarketComparison>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketComparison],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketComparison);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
