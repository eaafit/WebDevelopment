import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InAppNotificationsApiService, NotificationCounterService } from '@notary-portal/ui';
import { Admin } from './admin';
import { AdminPaymentsApiService } from '../features/payments/payments-api.service';

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
          provide: NotificationCounterService,
          useValue: {
            unreadCount: signal(0),
            startPolling: jest.fn(),
            stopPolling: jest.fn(),
          },
        },
        {
          provide: InAppNotificationsApiService,
          useValue: {
            listRecent: () => Promise.resolve({ notifications: [], unreadCount: 0 }),
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
