import { Component, OnDestroy, OnInit, inject, signal, ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardLayout, InAppNotificationsApiService } from '@notary-portal/ui';

const NOTARY_MENU = [
  { label: 'Главная', route: '.', icon: '🏠' },
  { label: 'Заказы', route: 'orders', icon: '📄' },
  { label: 'Подписка', route: 'subscription/checkout', icon: '👑' },
  { label: 'Транзакции', route: 'transactions', icon: '💳' },
  { label: 'Модуль оценки', route: 'assessment', icon: '📐' },
  { label: 'История заказов', route: 'assessment/history', icon: '📋' },
  { label: 'Мониторинг', route: 'monitoring', icon: '🖥' },
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
  private readonly notificationsApi = inject(InAppNotificationsApiService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  menuItems = NOTARY_MENU;
  pageTitle = 'Личный кабинет нотариуса';
  userLabel = 'Нотариус';
  unreadNotifications = signal(0);

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
