import { Component, ViewEncapsulation, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardLayout } from '@notary-portal/ui';
import { AdminPaymentsApiService } from '../features/payments/payments-api.service';
import { AdminApplicationsApiService } from '../features/RequestAssessment/applications-api.service';

const ADMIN_MENU = [
  { label: 'Главное меню', route: '.', icon: '☰', exact: true },
  { label: 'Пользователи', route: 'users', icon: '👥' },
  { label: 'Управление заказами', route: 'applications', icon: '📄' },
  { label: 'Управление статусами', route: 'orders/statuses', icon: '🔄' },
  { label: 'Очередь оценок', route: 'orders/queue', icon: '📝' },
  { label: 'Ручная модерация', route: 'orders/moderation', icon: '✅' },
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
  { label: 'Настройки', route: 'settings', icon: '⚙' },
];

@Component({
  selector: 'lib-admin',
  imports: [RouterModule, DashboardLayout],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Admin {
  menuItems = ADMIN_MENU;
  pageTitle = 'Панель администратора';
  userLabel = 'Администратор';

  private readonly paymentsApi = inject(AdminPaymentsApiService);
  private readonly applicationsApi = inject(AdminApplicationsApiService);

  constructor() {
    this.paymentsApi.preload();
    this.applicationsApi.preload();
  }
}
