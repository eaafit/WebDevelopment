import { Component, ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardLayout } from '@notary-portal/ui';

const ADMIN_MENU = [
  { label: 'Главное меню', route: '.', icon: '☰' },
  { label: 'Пользователи', route: 'users', icon: '👥' },
  { label: 'Заявки', route: 'orders', icon: '📄' },
  { label: 'Платежи', route: 'payments', icon: '💳' },
  { label: 'Подписки', route: 'subscriptions', icon: '👑' },
  { label: 'Тарифные планы', route: 'plans', icon: '📋' },
  { label: 'Модерация файлов', route: 'files', icon: '📁' },
  { label: 'Рассылка', route: 'newsletter', icon: '📧' },
  { label: 'Мониторинг и логи', route: 'monitoring', icon: '🖥' },
  { label: 'Уведомления', route: 'notifications', icon: '🔔' },
  { label: 'Статистика', route: 'statistics', icon: '📊' },
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
}
