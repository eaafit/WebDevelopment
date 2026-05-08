import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import type { Notification as RpcNotification } from '@notary-portal/api-contracts';
import { InAppNotificationsApiService, notificationOccurredAt } from '@notary-portal/ui';

type NotificationLifecycle = 'sent' | 'read';

interface AdminNotification {
  id: string;
  title: string;
  description: string;
  details: string[];
  createdAt: Date;
  lifecycle: NotificationLifecycle;
}

@Component({
  selector: 'lib-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class AdminNotifications implements OnInit, OnDestroy {
  private readonly notificationsApi = inject(InAppNotificationsApiService);

  protected readonly notifications = signal<AdminNotification[]>([]);
  protected readonly filtered = computed(() => this.notifications());
  protected readonly inboxCount = computed(() => this.notifications().filter((n) => n.lifecycle === 'sent').length);

  protected lifecycleLabel(l: NotificationLifecycle): string {
    return l === 'sent' ? 'Отправлено' : 'Прочитано';
  }

  async ngOnInit(): Promise<void> {
    await this.refreshNotifications();
  }

  ngOnDestroy(): void {}

  protected async markAllAsRead(): Promise<void> {
    await this.notificationsApi.markAllAsRead();
    await this.refreshNotifications();
  }

  protected async toggleReadOnCard(id: string): Promise<void> {
    const target = this.notifications().find((item) => item.id === id);
    if (!target || target.lifecycle === 'read') return;
    await this.notificationsApi.markAsRead(id);
    await this.refreshNotifications();
  }

  protected async deleteOne(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.notificationsApi.deleteNotification(id);
    await this.refreshNotifications();
  }

  protected async clearAllHistory(): Promise<void> {
    if (!confirm('Удалить всю историю уведомлений из списка?')) {
      return;
    }
    await Promise.all(this.notifications().map((item) => this.notificationsApi.deleteNotification(item.id)));
    await this.refreshNotifications();
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
    this.notifications.set(notifications.map((item) => this.toUiNotification(item)));
  }

  private toUiNotification(notification: RpcNotification): AdminNotification {
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
}
