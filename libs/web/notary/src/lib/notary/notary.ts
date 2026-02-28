import { Component, ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardLayout } from '@notary-portal/ui';

const NOTARY_MENU = [
  { label: 'Главная', route: '.', icon: '🏠' },
  { label: 'Заказы', route: 'orders', icon: '📄' },
  { label: 'Подписка', route: 'subscription', icon: '👑' },
  { label: 'Транзакции', route: 'transactions', icon: '💳' },
  { label: 'Модуль оценки', route: 'assessment', icon: '📐' },
  { label: 'Копии документов', route: 'copies', icon: '📑' },
  { label: 'Уведомления', route: 'notifications', icon: '🔔' },
  { label: 'Поддержка', route: 'support', icon: '💬' },
  { label: 'Справочник', route: 'faq', icon: '❓' },
];

@Component({
  selector: 'lib-notary',
  imports: [RouterModule, DashboardLayout],
  templateUrl: './notary.html',
  styleUrl: './notary.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Notary {
  menuItems = NOTARY_MENU;
  pageTitle = 'Личный кабинет нотариуса';
  userLabel = 'Нотариус';
}
