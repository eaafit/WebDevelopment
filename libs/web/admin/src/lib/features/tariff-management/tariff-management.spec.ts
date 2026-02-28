import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TariffManagement } from './tariff-management';

describe('TariffManagement', () => {
  let component: TariffManagement;
  let fixture: ComponentFixture<TariffManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TariffManagement],
    }).compileComponents();

    fixture = TestBed.createComponent(TariffManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
