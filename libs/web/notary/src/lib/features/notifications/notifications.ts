import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import type { Notification as RpcNotification } from '@notary-portal/api-contracts';
import {
  InAppNotificationsApiService,
  notificationOccurredAt,
} from '@notary-portal/ui';

export type UserNotificationLifecycle = 'sent' | 'read';

interface UiNotification {
  id: string;
  title: string;
  description: string;
  details: string[];
  createdAt: Date;
  lifecycle: UserNotificationLifecycle;
}

@Component({
  selector: 'lib-notary-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class NotaryNotifications {
  private readonly notificationsApi = inject(InAppNotificationsApiService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly dismissedPopupIds = new Set<string>();

  protected readonly notifications = signal<UiNotification[]>([]);
  protected readonly popupNotification = signal<UiNotification | null>(null);
  protected readonly inboxCount = computed(() => this.notifications().filter((n) => n.lifecycle === 'sent').length);
  protected readonly filtered = computed(() => this.notifications());

  protected lifecycleLabel(l: UserNotificationLifecycle): string {
    return l === 'sent' ? 'Отправлено' : 'Прочитано';
  }

  async ngOnInit(): Promise<void> {
    await this.refreshNotifications();
    this.refreshTimer = setInterval(() => {
      void this.refreshNotifications();
    }, 20_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  protected async markAllAsRead(): Promise<void> {
    await this.notificationsApi.markAllAsRead();
    await this.refreshNotifications();
  }

  protected async toggleReadOnCard(id: string): Promise<void> {
    const target = this.notifications().find((item) => item.id === id);
    if (!target || target.lifecycle === 'read') {
      return;
    }

    await this.notificationsApi.markAsRead(id);
    await this.refreshNotifications();
  }

  protected async removeOne(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.notificationsApi.deleteNotification(id);
    await this.refreshNotifications();
  }

  protected async clearAllHistory(): Promise<void> {
    if (!confirm('Очистить всю историю уведомлений?')) {
      return;
    }

    await Promise.all(this.notifications().map((item) => this.notificationsApi.deleteNotification(item.id)));
    await this.refreshNotifications();
  }

  protected closePopup(): void {
    const popup = this.popupNotification();
    if (popup) {
      this.dismissedPopupIds.add(popup.id);
    }
    this.popupNotification.set(null);
  }

  protected relativeTime(date: Date): string {
    const diffMinutes = Math.round((Date.now() - date.getTime()) / 60_000);
    if (diffMinutes < 1) return 'только что';
    if (diffMinutes < 60) return `${diffMinutes} мин назад`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} ч назад`;

    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} дн назад`;
  }

  private async refreshNotifications(): Promise<void> {
    const { notifications } = await this.notificationsApi.listMine({ page: 1, limit: 50 });
    const mapped = notifications.map((item) => this.toUiNotification(item));
    this.notifications.set(mapped);
    this.showPopupForLatestUnread(mapped);
  }

  private toUiNotification(notification: RpcNotification): UiNotification {
    const lines = notification.message
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      id: notification.id,
      title: lines[0] ?? 'Уведомление',
      description: lines.slice(1, 2).join(' ') || notification.message,
      details: lines.slice(1),
      createdAt: notificationOccurredAt(notification),
      lifecycle: notification.readAt ? 'read' : 'sent',
    };
  }

  private showPopupForLatestUnread(items: UiNotification[]): void {
    const candidate = items.find((item) => item.lifecycle === 'sent' && !this.dismissedPopupIds.has(item.id));
    if (!candidate || this.popupNotification()?.id === candidate.id) {
      return;
    }

    this.popupNotification.set(candidate);
  }
}
