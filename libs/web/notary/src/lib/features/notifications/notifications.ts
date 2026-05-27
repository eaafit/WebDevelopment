import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NotificationCenterApiService,
  TokenStore,
  type NotificationCenterChannel,
  type NotificationCenterDomainType,
  type NotificationCenterItem,
} from '@notary-portal/ui';

/** У нотариуса в UI только «отправлено» и «прочитано» */
export type UserNotificationLifecycle = 'sent' | 'read';
type NotificationChannel = NotificationCenterChannel;
type NotificationType = NotificationCenterDomainType;

interface NotaryNotification {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  relativeTime: string;
  type: NotificationType;
  channel: NotificationChannel;
  lifecycle: UserNotificationLifecycle;
}

type UserLifecycleFilter = 'all' | UserNotificationLifecycle;

interface NotaryNotificationFilters {
  type: 'all' | NotificationType;
  channel: 'all' | NotificationChannel;
  lifecycle: UserLifecycleFilter;
}

const DEFAULT_FILTERS: NotaryNotificationFilters = {
  type: 'all',
  channel: 'all',
  lifecycle: 'all',
};

@Component({
  selector: 'lib-notary-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class NotaryNotifications {
  protected readonly filters = signal<NotaryNotificationFilters>({ ...DEFAULT_FILTERS });
  protected readonly notifications = signal<NotaryNotification[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly api = inject(NotificationCenterApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tokenStore = inject(TokenStore);

  protected readonly filtered = computed(() => {
    const { type, channel, lifecycle } = this.filters();

    return this.notifications().filter((n) => {
      if (type !== 'all' && n.type !== type) return false;
      if (channel !== 'all' && n.channel !== channel) return false;
      if (lifecycle !== 'all' && n.lifecycle !== lifecycle) return false;
      return true;
    });
  });

  protected readonly inboxCount = computed(
    () => this.notifications().filter((n) => n.lifecycle === 'sent').length,
  );

  constructor() {
    this.loadNotifications();
  }

  protected setFilter<K extends keyof NotaryNotificationFilters>(
    key: K,
    value: NotaryNotificationFilters[K],
  ): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
  }

  protected lifecycleLabel(l: UserNotificationLifecycle): string {
    return l === 'sent' ? 'Отправлено' : 'Прочитано';
  }

  protected typeLabel(type: NotificationType): string {
    switch (type) {
      case 'application':
        return 'Заявка';
      case 'document':
        return 'Документы';
      case 'payment':
        return 'Платёж';
      case 'assessment':
        return 'Оценка';
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
      case 'in-app':
        return 'In-app';
      case 'push':
      default:
        return 'Push';
    }
  }

  protected markAllAsRead(): void {
    const userId = this.currentUserId();
    if (!userId) return;

    this.api
      .markAllAsRead(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.update((items) =>
            items.map((n) => ({
              ...n,
              lifecycle: 'read' as const,
            })),
          );
        },
        error: () => this.error.set('Не удалось отметить уведомления прочитанными.'),
      });
  }

  protected toggleReadOnCard(id: string): void {
    const target = this.notifications().find((item) => item.id === id);
    if (!target || target.lifecycle === 'read') {
      return;
    }

    this.api
      .markAsRead(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.update((items) =>
            items.map((n) => (n.id === id ? { ...n, lifecycle: 'read' as const } : n)),
          );
        },
        error: () => this.error.set('Не удалось отметить уведомление прочитанным.'),
      });
  }

  protected removeOne(id: string, event: Event): void {
    event.stopPropagation();
    this.deleteNotification(id);
  }

  protected clearAllHistory(): void {
    if (!confirm('Очистить всю историю уведомлений?')) {
      return;
    }

    for (const notification of this.notifications()) {
      this.deleteNotification(notification.id);
    }
  }

  protected reloadNotifications(): void {
    this.loadNotifications();
  }

  private deleteNotification(id: string): void {
    this.api
      .deleteNotification(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.notifications.update((items) => items.filter((n) => n.id !== id)),
        error: () => this.error.set('Не удалось удалить уведомление.'),
      });
  }

  private loadNotifications(): void {
    const userId = this.currentUserId();
    if (!userId) {
      this.error.set('Не удалось определить текущего пользователя для загрузки уведомлений.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.api
      .listNotifications(userId, { limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.notifications.set(page.notifications.map(toNotaryNotification));
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Не удалось загрузить уведомления.');
          this.loading.set(false);
        },
      });
  }

  private currentUserId(): string {
    return this.tokenStore.user()?.id ?? '';
  }
}

function toNotaryNotification(item: NotificationCenterItem): NotaryNotification {
  return {
    ...item,
    lifecycle: item.lifecycle === 'read' ? 'read' : 'sent',
  };
}
