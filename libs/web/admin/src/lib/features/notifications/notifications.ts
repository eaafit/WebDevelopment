import { CommonModule } from '@angular/common';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import {
  NotificationCategory as RpcNotificationCategory,
  NotificationStatus as RpcNotificationStatus,
  NotificationType as RpcNotificationType,
  type Notification as RpcNotification,
} from '@notary-portal/api-contracts';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { TokenStore } from '@notary-portal/ui';
import { AdminNotificationsApiService } from './notifications-api.service';

export type NotificationLifecycle = 'created' | 'sent' | 'failed' | 'read' | 'deleted';
type NotificationChannel = 'in-app' | 'email' | 'sms' | 'push';
type NotificationCategory = 'application' | 'document' | 'payment' | 'system' | 'assessment';

interface AdminNotification {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  relativeTime: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  lifecycle: NotificationLifecycle;
}

type LifecycleFilter = 'active' | 'all' | NotificationLifecycle;

interface AdminNotificationFilters {
  category: 'all' | NotificationCategory;
  channel: 'all' | NotificationChannel;
  lifecycle: LifecycleFilter;
}

const DEFAULT_FILTERS: AdminNotificationFilters = {
  category: 'all',
  channel: 'all',
  lifecycle: 'active',
};

@Component({
  selector: 'lib-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class AdminNotifications implements OnInit {
  private readonly api = inject(AdminNotificationsApiService);
  private readonly tokenStore = inject(TokenStore);

  protected readonly filters = signal<AdminNotificationFilters>({ ...DEFAULT_FILTERS });
  protected readonly isLoading = signal(true);
  protected readonly hasLoadError = signal(false);

  protected readonly notifications = signal<AdminNotification[]>([]);

  protected readonly filtered = computed(() => {
    const { category, channel, lifecycle } = this.filters();

    return this.notifications().filter((n) => {
      if (category !== 'all' && n.category !== category) return false;
      if (channel !== 'all' && n.channel !== channel) return false;

      if (lifecycle === 'active') {
        if (n.lifecycle === 'deleted') return false;
      } else if (lifecycle === 'all') {
        // no extra filter
      } else if (n.lifecycle !== lifecycle) {
        return false;
      }

      return true;
    });
  });

  protected readonly inboxCount = computed(
    () =>
      this.notifications().filter(
        (n) => n.lifecycle === 'sent' || n.lifecycle === 'created' || n.lifecycle === 'failed',
      ).length,
  );

  async ngOnInit(): Promise<void> {
    await this.loadNotifications();
  }

  protected setFilter<K extends keyof AdminNotificationFilters>(
    key: K,
    value: AdminNotificationFilters[K],
  ): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
  }

  protected lifecycleLabel(l: NotificationLifecycle): string {
    switch (l) {
      case 'created':
        return 'Создано';
      case 'sent':
        return 'Отправлено';
      case 'failed':
        return 'Ошибка';
      case 'read':
        return 'Прочитано';
      case 'deleted':
        return 'Удалено';
    }
  }

  protected categoryLabel(category: NotificationCategory): string {
    switch (category) {
      case 'application':
        return 'Заявки';
      case 'document':
        return 'Документы';
      case 'payment':
        return 'Платежи';
      case 'assessment':
        return 'Оценки';
      case 'system':
      default:
        return 'Система';
    }
  }

  protected channelLabel(channel: NotificationChannel): string {
    switch (channel) {
      case 'email':
        return 'Email';
      case 'sms':
        return 'SMS';
      case 'push':
        return 'Push';
      case 'in-app':
      default:
        return 'In-app';
    }
  }

  protected async markAllAsRead(): Promise<void> {
    const userId = this.tokenStore.user()?.id?.trim();
    if (!userId) return;

    await this.api.markAllAsRead(userId);
    this.notifications.update((items) =>
      items.map((n) =>
        n.lifecycle === 'deleted'
          ? n
          : {
              ...n,
              lifecycle: 'read' as const,
            },
      ),
    );
  }

  protected async markReadOnCard(id: string): Promise<void> {
    const current = this.notifications().find((n) => n.id === id);
    if (!current || current.lifecycle === 'deleted' || current.lifecycle === 'read') return;

    await this.api.markAsRead(id);
    this.notifications.update((items) =>
      items.map((n) => {
        if (n.id !== id || n.lifecycle === 'deleted') return n;
        return { ...n, lifecycle: 'read' };
      }),
    );
  }

  protected async deleteOne(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.api.deleteNotification(id);
    this.notifications.update((items) =>
      items.map((n) => (n.id === id ? { ...n, lifecycle: 'deleted' as const } : n)),
    );
  }

  protected async clearAllHistory(): Promise<void> {
    if (!confirm('Удалить всю историю уведомлений из списка?')) {
      return;
    }

    await Promise.all(
      this.notifications()
        .filter((item) => item.lifecycle !== 'deleted')
        .map((item) => this.api.deleteNotification(item.id)),
    );
    this.notifications.set([]);
  }

  private async loadNotifications(): Promise<void> {
    const userId = this.tokenStore.user()?.id?.trim();
    if (!userId) {
      this.isLoading.set(false);
      return;
    }

    try {
      const notifications = await this.api.listNotifications(userId);
      this.notifications.set(notifications.map((item) => toAdminNotification(item)));
    } catch {
      this.hasLoadError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }
}

function toAdminNotification(notification: RpcNotification): AdminNotification {
  const createdAt = notification.sentAt ? timestampDate(notification.sentAt) : new Date();

  return {
    id: notification.id,
    title: notification.title || 'Уведомление',
    description: notification.message,
    createdAt: createdAt.toISOString(),
    relativeTime: formatRelativeTime(createdAt),
    category: fromRpcCategory(notification.category),
    channel: fromRpcChannel(notification.type),
    lifecycle: fromRpcLifecycle(notification),
  };
}

function fromRpcCategory(category: RpcNotificationCategory): NotificationCategory {
  switch (category) {
    case RpcNotificationCategory.APPLICATION:
      return 'application';
    case RpcNotificationCategory.DOCUMENT:
      return 'document';
    case RpcNotificationCategory.PAYMENT:
      return 'payment';
    case RpcNotificationCategory.ASSESSMENT:
      return 'assessment';
    case RpcNotificationCategory.SYSTEM:
    case RpcNotificationCategory.UNSPECIFIED:
    default:
      return 'system';
  }
}

function fromRpcChannel(type: RpcNotificationType): NotificationChannel {
  switch (type) {
    case RpcNotificationType.EMAIL:
      return 'email';
    case RpcNotificationType.SMS:
      return 'sms';
    case RpcNotificationType.PUSH:
      return 'push';
    case RpcNotificationType.IN_APP:
    case RpcNotificationType.UNSPECIFIED:
    default:
      return 'in-app';
  }
}

function fromRpcLifecycle(notification: RpcNotification): NotificationLifecycle {
  if (notification.readAt) {
    return 'read';
  }

  switch (notification.status) {
    case RpcNotificationStatus.PENDING:
      return 'created';
    case RpcNotificationStatus.FAILED:
      return 'failed';
    case RpcNotificationStatus.SENT:
    case RpcNotificationStatus.UNSPECIFIED:
    default:
      return 'sent';
  }
}

function formatRelativeTime(date: Date): string {
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;

  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}
