import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WebLoggerService } from '@notary-portal/ui';
import {
  AdminNotificationsApiService,
  type AdminNotificationCategory,
  type AdminNotificationChannel,
  type AdminNotificationRecord,
} from './notifications-api.service';

export type NotificationLifecycle = 'created' | 'sent' | 'failed' | 'read' | 'deleted';
type LifecycleFilter = 'active' | 'all' | NotificationLifecycle;

interface AdminNotification {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  relativeTime: string;
  category: AdminNotificationCategory;
  channel: AdminNotificationChannel;
  lifecycle: NotificationLifecycle;
}

interface AdminNotificationFilters {
  category: 'all' | AdminNotificationCategory;
  channel: 'all' | AdminNotificationChannel;
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
  imports: [CommonModule, RouterLink],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class AdminNotifications implements OnInit, OnDestroy {
  private readonly api = inject(AdminNotificationsApiService);
  private readonly logger = inject(WebLoggerService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly filters = signal<AdminNotificationFilters>({ ...DEFAULT_FILTERS });
  protected readonly notifications = signal<AdminNotification[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

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

  ngOnInit(): void {
    void this.loadNotifications();
    this.refreshTimer = setInterval(() => {
      void this.loadNotifications();
    }, 30_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
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

  protected categoryLabel(category: AdminNotificationCategory): string {
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

  protected channelLabel(channel: AdminNotificationChannel): string {
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
    try {
      await this.api.markAllAsRead();
      this.actionError.set(null);
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
    } catch (error) {
      this.actionError.set('Не удалось отметить уведомления прочитанными.');
      this.handleActionError('notification.admin.mark_all_failed', error);
    }
  }

  protected async markReadOnCard(id: string): Promise<void> {
    const current = this.notifications().find((item) => item.id === id);
    if (!current || current.lifecycle === 'read' || current.lifecycle === 'deleted') {
      return;
    }

    try {
      const updated = await this.api.markAsRead(id);
      this.actionError.set(null);
      this.notifications.update((items) =>
        items.map((n) =>
          n.id === id
            ? updated
              ? toAdminNotification(updated)
              : { ...n, lifecycle: 'read' as const }
            : n,
        ),
      );
    } catch (error) {
      this.actionError.set('Не удалось отметить уведомление прочитанным.');
      this.handleActionError('notification.admin.mark_one_failed', error, { notificationId: id });
    }
  }

  protected async deleteOne(id: string, event: Event): Promise<void> {
    event.stopPropagation();

    try {
      const success = await this.api.deleteNotification(id);
      if (!success) {
        this.handleActionError('notification.admin.delete_stale', new Error('stale notification'), {
          notificationId: id,
        });
      }

      this.actionError.set(null);
      this.notifications.update((items) => items.filter((n) => n.id !== id));
    } catch (error) {
      this.actionError.set('Не удалось удалить уведомление.');
      this.handleActionError('notification.admin.delete_failed', error, { notificationId: id });
    }
  }

  protected async clearAllHistory(): Promise<void> {
    if (!confirm('Удалить всю историю уведомлений из списка?')) {
      return;
    }

    const ids = this.notifications().map((item) => item.id);
    const results = await Promise.allSettled(
      ids.map(async (id) => ({
        id,
        success: await this.api.deleteNotification(id),
      })),
    );
    const deletedIds = new Set(
      results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value.id),
    );
    const failedCount = results.length - deletedIds.size;

    if (deletedIds.size) {
      this.notifications.update((items) => items.filter((item) => !deletedIds.has(item.id)));
    }

    if (failedCount) {
      this.actionError.set(`Не удалось удалить уведомлений: ${failedCount}`);
      this.handleActionError('notification.admin.clear_failed', new Error('partial clear failed'), {
        failedCount,
      });
    } else {
      this.actionError.set(null);
    }
  }

  protected async reload(): Promise<void> {
    await this.loadNotifications();
  }

  private async loadNotifications(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    this.logger.info('notification.admin.list_load_started', {
      area: 'admin_notifications',
    });

    try {
      const response = await this.api.listNotifications();
      this.actionError.set(null);
      this.notifications.set(response.notifications.map(toAdminNotification));
      this.logger.info('notification.admin.list_load_succeeded', {
        area: 'admin_notifications',
        total: response.notifications.length,
        unreadCount: response.unreadCount,
      });
    } catch (error) {
      this.notifications.set([]);
      this.loadError.set('Не удалось загрузить уведомления с сервера');
      this.handleActionError('notification.admin.list_load_failed', error);
    } finally {
      this.loading.set(false);
    }
  }

  private handleActionError(
    event: string,
    error: unknown,
    context: Record<string, unknown> = {},
  ): void {
    this.logger.error(event, {
      area: 'admin_notifications',
      ...context,
      error,
    });
  }
}

function toAdminNotification(item: AdminNotificationRecord): AdminNotification {
  return {
    id: item.id,
    title: item.title,
    description: item.message,
    createdAt: item.sentAt.toISOString(),
    relativeTime: formatRelativeTime(item.sentAt),
    category: item.category,
    channel: item.channel,
    lifecycle: item.readAt ? 'read' : item.deliveryStatus,
  };
}

function formatRelativeTime(date: Date): string {
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) {
    return 'только что';
  }

  if (minutes < 60) {
    return `${minutes} мин назад`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ч назад`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} дн назад`;
  }

  return date.toLocaleDateString('ru-RU');
}
