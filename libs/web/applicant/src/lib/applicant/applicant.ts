import { Component, inject, ViewEncapsulation, OnInit, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardLayout, NotificationCounterService } from '@notary-portal/ui';

const APPLICANT_MENU = [
  { label: 'Главная', route: '.', icon: '🏠' },
  { label: 'Мои заявки', route: 'orders', icon: '📄' },
  { label: 'Подать заявку', route: 'orders/new', icon: '➕' },
  { label: 'Документы', route: 'documents', icon: '📁' },
  { label: 'Модуль оценки', route: 'assessment', icon: '📐' },
  { label: 'Результаты оценки', route: 'assessment/results', icon: '📊' },
  { label: 'История заказов', route: 'assessment/history', icon: '📋' },
  { label: 'Платежи', route: 'payments', icon: '💳' },
  { label: 'Оплата услуги', route: 'checkout', icon: '🧾' },
  { label: 'Копии документов', route: 'copies', icon: '📑' },
  { label: 'Уведомления', route: 'notifications', icon: '🔔' },
  { label: 'Поддержка', route: 'support', icon: '💬' },
  { label: 'Справочник', route: 'faq', icon: '❓' },
];

@Component({
  selector: 'lib-applicant',
  imports: [RouterModule, DashboardLayout],
  templateUrl: './applicant.html',
  styleUrl: './applicant.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Applicant implements OnInit, OnDestroy {
  private readonly notificationCounter = inject(NotificationCounterService);

  menuItems = APPLICANT_MENU;
  pageTitle = 'Личный кабинет заявителя';
  userLabel = 'Заявитель';
  unreadNotifications = this.notificationCounter.unreadCount;

  ngOnInit(): void {
    this.notificationCounter.startPolling();
  }

  ngOnDestroy(): void {
    this.notificationCounter.stopPolling();
  }
}
