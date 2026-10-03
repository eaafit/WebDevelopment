import { Component, inject, ViewEncapsulation, OnInit, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardLayout, NotificationCounterService } from '@notary-portal/ui';
import { AdminPaymentsApiService } from '../features/payments/payments-api.service';

const ADMIN_MENU = [
  { label: 'Главное меню', route: '.', icon: '☰', exact: true },
  { label: 'Пользователи', route: 'users', icon: '👥' },
  { label: 'Управление заказами', route: 'orders', icon: '📄', exact: true },
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
  { label: 'Создать рассылку', route: 'newsletter', icon: '📧', exact: true },
  { label: 'Журнал отправленных писем', route: 'newsletter/history', icon: '✉️', exact: true },
  { label: 'Мониторинг и логи', route: 'monitoring', icon: '🖥' },
  { label: 'Уведомления', route: 'notifications', icon: '🔔' },
  { label: 'Статистика', route: 'statistics', icon: '📊' },
  { label: 'География объектов', route: 'geography', icon: '🗺' },
  { label: 'Bitrix24', route: 'bitrix/config', icon: '🔗' },
  { label: 'Настройки', route: 'settings', icon: '⚙' },
  { label: 'Поддержка', route:'/admin/support', icon: '👀'}
];

@Component({
  selector: 'lib-admin',
  imports: [RouterModule, DashboardLayout],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Admin implements OnInit, OnDestroy {
  private readonly notificationCounter = inject(NotificationCounterService);
  private readonly paymentsApi = inject(AdminPaymentsApiService);

  menuItems = ADMIN_MENU;
  pageTitle = 'Панель администратора';
  userLabel = 'Администратор';
  unreadNotifications = this.notificationCounter.unreadCount;

  ngOnInit(): void {
    this.notificationCounter.startPolling();
    this.paymentsApi.preload();
  }

  ngOnDestroy(): void {
    this.notificationCounter.stopPolling();
  }
}
