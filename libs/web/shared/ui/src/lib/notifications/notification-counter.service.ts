import { Injectable, inject, signal } from '@angular/core';
import { InAppNotificationsApiService } from '../rpc/in-app-notifications-api.service';
import { TokenStore } from '../rpc/token-store';

/**
 * Общий счётчик непрочитанных для колокольчика и страницы уведомлений.
 * Обновляется по polling и сразу после действий пользователя (прочитать / удалить).
 */
@Injectable({ providedIn: 'root' })
export class NotificationCounterService {
  private readonly notificationsApi = inject(InAppNotificationsApiService);
  private readonly tokenStore = inject(TokenStore);

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private pollingSubscribers = 0;

  readonly unreadCount = signal(0);

  startPolling(intervalMs = 30_000): void {
    this.pollingSubscribers += 1;
    if (this.refreshTimer) {
      return;
    }

    void this.refresh();
    this.refreshTimer = setInterval(() => {
      void this.refresh();
    }, intervalMs);
  }

  stopPolling(): void {
    this.pollingSubscribers = Math.max(0, this.pollingSubscribers - 1);
    if (this.pollingSubscribers > 0 || !this.refreshTimer) {
      return;
    }

    clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  async refresh(): Promise<void> {
    if (!this.tokenStore.user()?.id) {
      this.unreadCount.set(0);
      return;
    }

    const { unreadCount } = await this.notificationsApi.listRecent(1);
    this.unreadCount.set(unreadCount);
  }

  setUnreadCount(count: number): void {
    this.unreadCount.set(Math.max(0, count));
  }

  adjustUnreadCount(delta: number): void {
    this.unreadCount.update((current) => Math.max(0, current + delta));
  }

  markOneAsRead(): void {
    this.adjustUnreadCount(-1);
  }

  markAllAsRead(): void {
    this.unreadCount.set(0);
  }
}
