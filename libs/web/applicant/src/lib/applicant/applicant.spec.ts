import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InAppNotificationsApiService, NotificationCounterService } from '@notary-portal/ui';
import { Applicant } from './applicant';

describe('Applicant', () => {
  let component: Applicant;
  let fixture: ComponentFixture<Applicant>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Applicant],
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
            listRecent: () => Promise.resolve({ notifications: [], unreadCount: 0 }),
          },
        },
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
