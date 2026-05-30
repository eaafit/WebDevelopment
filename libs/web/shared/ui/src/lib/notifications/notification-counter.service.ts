import { Injectable, inject, signal } from '@angular/core';
import { InAppNotificationsApiService } from '../rpc/in-app-notifications-api.service';
import { TokenStore } from '../rpc/token-store';

/**
 * Общий счётчик непрочитанных для колокольчика и страницы уведомлений.
 * Обновляется по polling и сразу после действий пользователя (прочитать / удалить).
 * Синхронизируется между вкладками браузера через BroadcastChannel API.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCounterService {
  private readonly notificationsApi = inject(InAppNotificationsApiService);
  private readonly tokenStore = inject(TokenStore);

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private pollingSubscribers = 0;
  private broadcastChannel: BroadcastChannel | null = null;

  readonly unreadCount = signal(0);

  startPolling(intervalMs = 30_000): void {
    this.pollingSubscribers += 1;
    if (this.refreshTimer) {
      return;
    }

    // Initialize BroadcastChannel for cross-tab synchronization
    this.initializeBroadcastChannel();

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

    // Close BroadcastChannel when polling stops
    this.closeBroadcastChannel();
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
    this.broadcastCounterUpdate();
  }

  private initializeBroadcastChannel(): void {
    if (this.broadcastChannel) {
      return;
    }

    try {
      this.broadcastChannel = new BroadcastChannel('notification-counter');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data.type === 'unread-count-updated') {
          this.unreadCount.set(event.data.count);
        }
      };
    } catch {
      // BroadcastChannel not supported in this browser
    }
  }

  private closeBroadcastChannel(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }

  private broadcastCounterUpdate(): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'unread-count-updated',
          count: this.unreadCount(),
        });
      } catch {
        // best-effort
      }
    }
  }
}
