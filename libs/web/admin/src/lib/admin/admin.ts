import { Component, OnDestroy, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardLayout, InAppNotificationsApiService } from '@notary-portal/ui';
import { AdminPaymentsApiService } from '../features/payments/payments-api.service';
import { AdminApplicationsApiService } from '../features/RequestAssessment/applications-api.service';

const ADMIN_MENU = [
  { label: 'Главное меню', route: '.', icon: '☰', exact: true },
  { label: 'Пользователи', route: 'users', icon: '👥' },
  { label: 'Управление заказами', route: 'applications', icon: '📄' },
  { label: 'Управление статусами', route: 'orders/statuses', icon: '🔄' },
  { label: 'Очередь оценок', route: 'orders/queue', icon: '📝' },
  { label: 'Ручная модерация', route: 'orders/moderation', icon: '✅' },
  { label: 'История статусов заявок', route: 'order-status-history', icon: '📜' },
  { label: 'Платежи', route: 'payments', icon: '💳' },
  { label: 'Подписки', route: 'subscriptions', icon: '👑' },
  { label: 'Тарифные планы', route: 'plans', icon: '📋' },
  { label: 'Скидки', route: 'discounts', icon: '🏷️' },
  { label: 'Промокоды', route: 'promocodes', icon: '🎫' },
  { label: 'Модерация файлов', route: 'files', icon: '📁' },
  { label: 'Рассылка', route: 'newsletter', icon: '📧' },
  { label: 'Мониторинг и логи', route: 'monitoring', icon: '🖥' },
  { label: 'Уведомления', route: 'notifications', icon: '🔔' },
  { label: 'Статистика', route: 'statistics', icon: '📊' },
  { label: 'География объектов', route: 'geography', icon: '🗺' },
  { label: 'Bitrix24', route: 'bitrix/config', icon: '🔗' },
  { label: 'Настройки', route: 'settings', icon: '⚙' },
];

@Component({
  selector: 'lib-admin',
  imports: [RouterModule, DashboardLayout],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Admin implements OnInit, OnDestroy {
  menuItems = ADMIN_MENU;
  pageTitle = 'Панель администратора';
  userLabel = 'Администратор';
  unreadNotifications = signal(0);

  private readonly paymentsApi = inject(AdminPaymentsApiService);
  private readonly applicationsApi = inject(AdminApplicationsApiService);
  private readonly notificationsApi = inject(InAppNotificationsApiService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.paymentsApi.preload();
    this.applicationsApi.preload();
  }

  async ngOnInit(): Promise<void> {
    await this.refreshUnreadCount();
    this.refreshTimer = setInterval(() => {
      void this.refreshUnreadCount();
    }, 30_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async refreshUnreadCount(): Promise<void> {
    const { unreadCount } = await this.notificationsApi.listMine({ page: 1, limit: 1, unreadOnly: true });
    this.unreadNotifications.set(unreadCount);
  }
}
