import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotificationCounterService, RPC_TRANSPORT } from '@notary-portal/ui';
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
        // Оболочка Admin тянет DashboardLayout (колокольчик уведомлений) ->
        // InAppNotificationsApiService -> RPC_TRANSPORT. В изолированном тесте
        // транспорт не нужен — отдаём заглушку, клиент создаётся лениво.
        { provide: RPC_TRANSPORT, useValue: {} },
        {
          provide: AdminPaymentsApiService,
          useValue: {
            preload: () => undefined,
            getAllPayments: () => Promise.resolve([]),
            invalidateCache: () => undefined,
          },
        },
        {
          // NotificationCounterService (зона уведомлений) тянет за собой
          // InAppNotificationsApiService -> RPC_TRANSPORT, который в этом
          // изолированном тесте не предоставляется. Мокаем только то, что
          // использует оболочка Admin: сигнал счётчика и старт/стоп polling.
          provide: NotificationCounterService,
          useValue: {
            unreadCount: signal(0),
            startPolling: () => undefined,
            stopPolling: () => undefined,
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
