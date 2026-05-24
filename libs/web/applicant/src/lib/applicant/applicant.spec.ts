import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Applicant } from './applicant';
import { RPC_TRANSPORT } from '@notary-portal/ui';

describe('Applicant', () => {
  let component: Applicant;
  let fixture: ComponentFixture<Applicant>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Applicant],
      providers: [
        provideRouter([]),
        { provide: RPC_TRANSPORT, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Applicant);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
