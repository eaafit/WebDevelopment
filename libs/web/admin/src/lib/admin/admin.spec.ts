import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Admin } from './admin';
import { AdminPaymentsApiService } from '../features/payments/payments-api.service';
import { AdminApplicationsApiService } from '../features/RequestAssessment/applications-api.service';

describe('Admin', () => {
  let component: Admin;
  let fixture: ComponentFixture<Admin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Admin],
      providers: [
        provideRouter([]),
        {
          provide: AdminPaymentsApiService,
          useValue: {
            preload: () => undefined,
            getAllPayments: () => Promise.resolve([]),
            invalidateCache: () => undefined,
          },
        },
        {
          provide: AdminApplicationsApiService,
          useValue: {
            preload: () => undefined,
            getAllApplications: () => Promise.resolve([]),
            invalidateCache: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Admin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should match main menu item only on the admin root route', () => {
    expect(component.menuItems[0]).toMatchObject({
      label: 'Главное меню',
      route: '.',
      exact: true,
    });
  });
});
