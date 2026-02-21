import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Notary } from './notary';

describe('Notary', () => {
  let component: Notary;
  let fixture: ComponentFixture<Notary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notary],
    }).compileComponents();

    fixture = TestBed.createComponent(Notary);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
