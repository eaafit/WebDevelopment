import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  InAppNotificationsApiService,
  NotificationCounterService,
  RPC_TRANSPORT,
} from '@notary-portal/ui';
import { Notary } from './notary';

describe('Notary', () => {
  let component: Notary;
  let fixture: ComponentFixture<Notary>;
  let unreadCount: ReturnType<typeof signal<number>>;
  let notificationCounterService: {
    unreadCount: typeof unreadCount;
    startPolling: jest.Mock;
    stopPolling: jest.Mock;
  };

  beforeEach(async () => {
    unreadCount = signal(0);
    notificationCounterService = {
      unreadCount,
      startPolling: jest.fn(),
      stopPolling: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Notary],
      providers: [
        provideRouter([]),
        { provide: RPC_TRANSPORT, useValue: {} },
        {
          provide: NotificationCounterService,
          useValue: notificationCounterService,
        },
        {
          provide: InAppNotificationsApiService,
          useValue: {
            listRecent: () => Promise.resolve({ notifications: [], unreadCount: 0 }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Notary);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts notification polling when the shell initializes', () => {
    expect(notificationCounterService.startPolling).toHaveBeenCalled();
    expect(notificationCounterService.stopPolling).not.toHaveBeenCalled();
  });

  it('stops notification polling when the shell is destroyed', () => {
    fixture.destroy();

    expect(notificationCounterService.stopPolling).toHaveBeenCalled();
  });

  it('exposes the shared unread notification counter signal', () => {
    unreadCount.set(5);

    expect(component.unreadNotifications()).toBe(5);
  });

  it('keeps notary workflow routes available in the shell menu', () => {
    expect(menuRoutes(component)).toEqual(
      expect.arrayContaining([
        '.',
        'orders',
        'subscription',
        'transactions',
        'assessment',
        'assessment/history',
        'copies',
        'notifications',
      ]),
    );
  });

  it('does not duplicate notary shell routes', () => {
    const routes = menuRoutes(component);

    expect(new Set(routes).size).toBe(routes.length);
  });
});

function menuRoutes(component: Notary): string[] {
  return component.menuItems.map((item) => item.route);
}
