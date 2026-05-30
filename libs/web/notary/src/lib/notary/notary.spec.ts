import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { InAppNotificationsApiService, NotificationCounterService } from '@notary-portal/ui';
import { Notary } from './notary';

describe('Notary', () => {
  let component: Notary;
  let fixture: ComponentFixture<Notary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notary],
      providers: [
        provideRouter([]),
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
            listRecent: jest
              .fn()
              .mockResolvedValue({ notifications: [], unreadCount: 0 }),
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
});
