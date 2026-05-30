import { Component, inject, signal, ViewEncapsulation, OnInit, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardLayout, NotificationCounterService } from '@notary-portal/ui';

const NOTARY_MENU = [
  { label: 'Главная', route: '.', icon: '🏠' },
  { label: 'Заказы', route: 'orders', icon: '📄' },
  { label: 'Подписка', route: 'subscription/checkout', icon: '👑' },
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
export class Notary implements OnInit, OnDestroy {
  private readonly notificationCounter = inject(NotificationCounterService);

  menuItems = NOTARY_MENU;
  pageTitle = 'Личный кабинет нотариуса';
  userLabel = 'Нотариус';
  unreadNotifications = this.notificationCounter.unreadCount;

  ngOnInit(): void {
    this.notificationCounter.startPolling();
  }

  ngOnDestroy(): void {
    this.notificationCounter.stopPolling();
  }
}
