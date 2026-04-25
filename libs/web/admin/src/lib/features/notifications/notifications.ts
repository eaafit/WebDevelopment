import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';

export type NotificationLifecycle = 'created' | 'sent' | 'read' | 'deleted';
type NotificationChannel = 'in-app' | 'email' | 'push';
type NotificationType = 'application' | 'document' | 'payment' | 'system';

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

const MOCK_NOTIFICATIONS: AdminNotification[] = [
  {
    id: 'n-1',
    title: 'Новый пользователь требует модерации',
    description: 'Профиль заявителя #U-2043 создан и ожидает проверки документов.',
    createdAt: '2026-03-10T10:24:00+03:00',
    relativeTime: '10 мин назад',
    type: 'system',
    channel: 'in-app',
    lifecycle: 'sent',
  },
  {
    id: 'n-2',
    title: 'Платёж по подписке успешно проведён',
    description: 'Нотариус Петров П.П. оплатил продление подписки по счёту №9823.',
    createdAt: '2026-03-10T09:05:00+03:00',
    relativeTime: '1 ч назад',
    type: 'payment',
    channel: 'email',
    lifecycle: 'sent',
  },
  {
    id: 'n-3',
    title: 'Импорт рассылочного списка завершён',
    description: 'Список для рассылки «Новости сервиса» успешно обновлён (1 245 адресов).',
    createdAt: '2026-03-09T16:40:00+03:00',
    relativeTime: 'вчера',
    type: 'system',
    channel: 'in-app',
    lifecycle: 'read',
  },
  {
    id: 'n-4',
    title: 'Отчёт по мониторингу доступен',
    description: 'Сформирован еженедельный отчёт по событиям аудита и безопасности.',
    createdAt: '2026-03-08T11:10:00+03:00',
    relativeTime: '2 дн назад',
    type: 'system',
    channel: 'email',
    lifecycle: 'read',
  },
  {
    id: 'n-5',
    title: 'Ошибка доставки письма',
    description: 'Не удалось отправить email-рассылку на 14 адресов (bounce).',
    createdAt: '2026-03-10T08:15:00+03:00',
    relativeTime: '2 ч назад',
    type: 'system',
    channel: 'email',
    lifecycle: 'sent',
  },
  {
    id: 'n-6',
    title: 'Изменение прав доступа',
    description: 'Для пользователя #U-2011 обновлена роль: Заявитель → Нотариус.',
    createdAt: '2026-03-09T09:10:00+03:00',
    relativeTime: 'вчера',
    type: 'system',
    channel: 'in-app',
    lifecycle: 'read',
  },
  {
    id: 'n-7',
    title: 'Подозрительная активность входа',
    description: 'Зафиксировано 5 неуспешных попыток входа подряд с IP 91.214.44.18.',
    createdAt: '2026-03-10T07:50:00+03:00',
    relativeTime: '2 ч назад',
    type: 'system',
    channel: 'email',
    lifecycle: 'sent',
  },
  {
    id: 'n-8',
    title: 'Ручная корректировка платежа',
    description: 'Администратор исправил сумму по платёжному документу #P-5104.',
    createdAt: '2026-03-07T16:15:00+03:00',
    relativeTime: '3 дн назад',
    type: 'payment',
    channel: 'in-app',
    lifecycle: 'read',
  },
  {
    id: 'n-9',
    title: 'Черновик служебного уведомления',
    description: 'Уведомление создано в системе, ожидает отправки по расписанию.',
    createdAt: '2026-03-10T11:00:00+03:00',
    relativeTime: '5 мин назад',
    type: 'system',
    channel: 'in-app',
    lifecycle: 'created',
  },
];

@Component({
  selector: 'lib-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class AdminNotifications {
  protected readonly filters = signal<AdminNotificationFilters>({ ...DEFAULT_FILTERS });

  protected readonly notifications = signal<AdminNotification[]>([...MOCK_NOTIFICATIONS]);

  protected readonly filtered = computed(() => {
    const { type, channel, lifecycle } = this.filters();

    return this.notifications().filter((n) => {
      if (type !== 'all' && n.type !== type) return false;
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
      this.notifications().filter((n) => n.lifecycle === 'sent' || n.lifecycle === 'created')
        .length,
  );

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
      case 'deleted':
        return 'Удалено';
    }
  }

  protected markAllAsRead(): void {
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

  protected toggleReadOnCard(id: string): void {
    this.notifications.update((items) =>
      items.map((n) => {
        if (n.id !== id || n.lifecycle === 'deleted') return n;
        if (n.lifecycle === 'read') {
          return { ...n, lifecycle: 'sent' };
        }
        return { ...n, lifecycle: 'read' };
      }),
    );
  }

  protected deleteOne(id: string, event: Event): void {
    event.stopPropagation();
    this.notifications.update((items) =>
      items.map((n) => (n.id === id ? { ...n, lifecycle: 'deleted' as const } : n)),
    );
  }

  protected clearAllHistory(): void {
    if (
      !confirm(
        'Удалить всю историю уведомлений из списка? (демо: записи будут очищены локально в браузере.)',
      )
    ) {
      return;
    }
    this.notifications.set([]);
  }

  protected restoreDemoData(): void {
    this.notifications.set([...MOCK_NOTIFICATIONS]);
    this.filters.set({ ...DEFAULT_FILTERS });
  }
}
