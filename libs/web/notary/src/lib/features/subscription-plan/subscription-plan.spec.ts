import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubscriptionPlan } from './subscription-plan';

describe('SubscriptionPlan', () => {
  let component: SubscriptionPlan;
  let fixture: ComponentFixture<SubscriptionPlan>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubscriptionPlan],
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionPlan);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
