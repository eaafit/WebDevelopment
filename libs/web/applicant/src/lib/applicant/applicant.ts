import { Component, ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardLayout } from '@notary-portal/ui';

const APPLICANT_MENU = [
  { label: 'Главная', route: '.', icon: '🏠' },
  { label: 'Мои заявки', route: 'orders', icon: '📄' },
  { label: 'Подать заявку', route: 'orders/new', icon: '➕' },
  { label: 'Документы', route: 'documents', icon: '📁' },
  { label: 'Модуль оценки', route: 'assessment', icon: '📐' },
  { label: 'Результаты оценки', route: 'assessment/results', icon: '📊' },
  { label: 'История заказов', route: 'assessment/history', icon: '📋' },
  { label: 'Платежи', route: 'payments', icon: '💳' },
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
export class Applicant {
  menuItems = APPLICANT_MENU;
  pageTitle = 'Личный кабинет заявителя';
  userLabel = 'Заявитель';
}
