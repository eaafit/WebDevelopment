import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NotificationCenterApiService,
  TokenStore,
  type NotificationCenterChannel,
  type NotificationCenterDomainType,
  type NotificationCenterItem,
  type NotificationCenterLifecycle,
} from '@notary-portal/ui';

export type NotificationLifecycle = NotificationCenterLifecycle;
type NotificationChannel = NotificationCenterChannel;
type NotificationType = NotificationCenterDomainType;

interface AdminNotification {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  relativeTime: string;
  type: NotificationType;
  channel: NotificationChannel;
  lifecycle: NotificationLifecycle;
}

type LifecycleFilter = 'active' | 'all' | NotificationLifecycle;

interface AdminNotificationFilters {
  type: 'all' | NotificationType;
  channel: 'all' | NotificationChannel;
  lifecycle: LifecycleFilter;
}

const DEFAULT_FILTERS: AdminNotificationFilters = {
  type: 'all',
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
export class AdminNotifications {
  protected readonly filters = signal<AdminNotificationFilters>({ ...DEFAULT_FILTERS });
  protected readonly notifications = signal<AdminNotification[]>([]);
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

      if (lifecycle !== 'active' && lifecycle !== 'all' && n.lifecycle !== lifecycle) {
        return false;
      }

      return true;
    });
  });

  protected readonly inboxCount = computed(
    () =>
      this.notifications().filter((n) => n.lifecycle === 'sent' || n.lifecycle === 'created')
        .length,
  );

  constructor() {
    this.loadNotifications();
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
      case 'read':
        return 'Прочитано';
      case 'failed':
        return 'Ошибка доставки';
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
            items.map((n) =>
              n.lifecycle === 'failed'
                ? n
                : {
                    ...n,
                    lifecycle: 'read' as const,
                  },
            ),
          );
        },
        error: () => this.error.set('Не удалось отметить уведомления прочитанными.'),
      });
  }

  protected toggleReadOnCard(id: string): void {
    const target = this.notifications().find((item) => item.id === id);
    if (!target || target.lifecycle === 'read' || target.lifecycle === 'failed') {
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

  protected deleteOne(id: string, event: Event): void {
    event.stopPropagation();
    this.deleteNotification(id);
  }

  protected clearAllHistory(): void {
    if (!confirm('Удалить всю историю уведомлений из списка?')) {
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
          this.notifications.set(page.notifications.map(toAdminNotification));
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

function toAdminNotification(item: NotificationCenterItem): AdminNotification {
  return item;
}
