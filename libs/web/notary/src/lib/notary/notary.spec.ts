import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Notary } from './notary';

describe('Notary', () => {
  let component: Notary;
  let fixture: ComponentFixture<Notary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notary],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Notary);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
