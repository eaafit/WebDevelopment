import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';

/** У нотариуса в UI только «отправлено» и «прочитано» */
export type UserNotificationLifecycle = 'sent' | 'read';
type NotificationChannel = 'in-app' | 'email' | 'push';
type NotificationType = 'application' | 'document' | 'payment' | 'system';

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

const MOCK_NOTIFICATIONS: NotaryNotification[] = [
  {
    id: 'n-1',
    title: 'Новая заявка на оценку',
    description: 'Поступила новая заявка на оценку недвижимости. Проверьте данные объекта.',
    createdAt: '2026-03-10T10:10:00+03:00',
    relativeTime: '15 мин назад',
    type: 'application',
    channel: 'in-app',
    lifecycle: 'sent',
  },
  {
    id: 'n-2',
    title: 'Сообщение в чате по заявке #1244',
    description: 'Заявитель задал вопрос по пакету документов. Ответьте в чате.',
    createdAt: '2026-03-10T09:35:00+03:00',
    relativeTime: '50 мин назад',
    type: 'system',
    channel: 'push',
    lifecycle: 'sent',
  },
  {
    id: 'n-3',
    title: 'Счёт на продление подписки',
    description: 'Сформирован счёт №9823 на продление подписки. Оплатите до 20 марта.',
    createdAt: '2026-03-09T17:45:00+03:00',
    relativeTime: 'вчера',
    type: 'payment',
    channel: 'email',
    lifecycle: 'read',
  },
  {
    id: 'n-4',
    title: 'Отчёт по заявке #1198 отправлен заявителю',
    description: 'Результаты оценки успешно отправлены на email заявителя.',
    createdAt: '2026-03-08T14:20:00+03:00',
    relativeTime: '2 дн назад',
    type: 'document',
    channel: 'in-app',
    lifecycle: 'read',
  },
  {
    id: 'n-5',
    title: 'Новый файл от заявителя',
    description: 'По заявке #1244 загружен дополнительный документ. Требуется проверка.',
    createdAt: '2026-03-10T08:30:00+03:00',
    relativeTime: '1 ч назад',
    type: 'document',
    channel: 'in-app',
    lifecycle: 'sent',
  },
  {
    id: 'n-6',
    title: 'Скоро окончание подписки',
    description: 'Подписка истекает через 3 дня. Оплатите счёт, чтобы не потерять доступ.',
    createdAt: '2026-03-05T09:00:00+03:00',
    relativeTime: '5 дн назад',
    type: 'payment',
    channel: 'email',
    lifecycle: 'read',
  },
  {
    id: 'n-7',
    title: 'Напоминание о невзятых в работу заявках',
    description: 'В очереди есть 4 новых заявки без исполнителя. Проверьте раздел «Заказы».',
    createdAt: '2026-03-10T07:45:00+03:00',
    relativeTime: '2 ч назад',
    type: 'application',
    channel: 'in-app',
    lifecycle: 'sent',
  },
];

@Component({
  selector: 'lib-notary-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class NotaryNotifications {
  protected readonly filters = signal<NotaryNotificationFilters>({ ...DEFAULT_FILTERS });

  protected readonly notifications = signal<NotaryNotification[]>([...MOCK_NOTIFICATIONS]);

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

  protected setFilter<K extends keyof NotaryNotificationFilters>(
    key: K,
    value: NotaryNotificationFilters[K],
  ): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
  }

  protected lifecycleLabel(l: UserNotificationLifecycle): string {
    return l === 'sent' ? 'Отправлено' : 'Прочитано';
  }

  protected markAllAsRead(): void {
    this.notifications.update((items) =>
      items.map((n) => ({
        ...n,
        lifecycle: 'read' as const,
      })),
    );
  }

  protected toggleReadOnCard(id: string): void {
    this.notifications.update((items) =>
      items.map((n) => {
        if (n.id !== id) return n;
        return { ...n, lifecycle: n.lifecycle === 'read' ? 'sent' : 'read' };
      }),
    );
  }

  protected removeOne(id: string, event: Event): void {
    event.stopPropagation();
    this.notifications.update((items) => items.filter((n) => n.id !== id));
  }

  protected clearAllHistory(): void {
    if (!confirm('Очистить всю историю уведомлений?')) {
      return;
    }
    this.notifications.set([]);
  }

  protected restoreDemoData(): void {
    this.notifications.set([...MOCK_NOTIFICATIONS]);
    this.filters.set({ ...DEFAULT_FILTERS });
  }
}
