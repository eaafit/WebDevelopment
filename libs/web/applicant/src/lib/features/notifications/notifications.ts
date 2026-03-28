import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';

export type NotificationLifecycle = 'created' | 'sent' | 'read' | 'deleted';
type NotificationChannel = 'in-app' | 'email' | 'push';
type NotificationType = 'application' | 'document' | 'payment' | 'system';

interface ApplicantNotification {
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

interface ApplicantNotificationFilters {
  type: 'all' | NotificationType;
  channel: 'all' | NotificationChannel;
  lifecycle: LifecycleFilter;
}

const DEFAULT_FILTERS: ApplicantNotificationFilters = {
  type: 'all',
  channel: 'all',
  lifecycle: 'active',
};

const MOCK_NOTIFICATIONS: ApplicantNotification[] = [
  {
    id: 'a-1',
    title: 'Заявка #1244 принята в работу',
    description: 'Нотариус начал проверку документов по вашей заявке на оценку наследства.',
    createdAt: '2026-03-10T10:24:00+03:00',
    relativeTime: '10 мин назад',
    type: 'application',
    channel: 'in-app',
    lifecycle: 'sent',
  },
  {
    id: 'a-2',
    title: 'Требуется дополнительный документ',
    description: 'Загрузите копию свидетельства о праве на наследство в раздел «Документы».',
    createdAt: '2026-03-10T09:40:00+03:00',
    relativeTime: '45 мин назад',
    type: 'document',
    channel: 'in-app',
    lifecycle: 'sent',
  },
  {
    id: 'a-3',
    title: 'Отчёт по оценке готов',
    description: 'Результаты оценки наследственного имущества доступны для скачивания в PDF.',
    createdAt: '2026-03-09T18:10:00+03:00',
    relativeTime: 'вчера',
    type: 'document',
    channel: 'email',
    lifecycle: 'read',
  },
  {
    id: 'a-4',
    title: 'Платёж успешно проведён',
    description: 'Оплата по счёту №5110 за услугу оценки прошла успешно.',
    createdAt: '2026-03-08T12:20:00+03:00',
    relativeTime: '2 дн назад',
    type: 'payment',
    channel: 'email',
    lifecycle: 'read',
  },
  {
    id: 'a-5',
    title: 'Напоминание о незавершённой заявке',
    description: 'Вы начали заполнять заявку #1250, но не отправили её. Продолжите оформление.',
    createdAt: '2026-03-07T19:30:00+03:00',
    relativeTime: '3 дн назад',
    type: 'application',
    channel: 'in-app',
    lifecycle: 'sent',
  },
  {
    id: 'a-6',
    title: 'Изменена дата встречи у нотариуса',
    description: 'Назначенная встреча по заявке #1198 перенесена на 15 марта в 14:00.',
    createdAt: '2026-03-06T11:05:00+03:00',
    relativeTime: '4 дн назад',
    type: 'system',
    channel: 'email',
    lifecycle: 'read',
  },
  {
    id: 'a-7',
    title: 'Новый ответ в чате поддержки',
    description: 'Специалист поддержки ответил на ваш вопрос по загрузке документов.',
    createdAt: '2026-03-10T08:55:00+03:00',
    relativeTime: '1 ч назад',
    type: 'system',
    channel: 'push',
    lifecycle: 'created',
  },
];

@Component({
  selector: 'applicant-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class ApplicantNotifications {
  protected readonly filters = signal<ApplicantNotificationFilters>({ ...DEFAULT_FILTERS });

  protected readonly notifications = signal<ApplicantNotification[]>([...MOCK_NOTIFICATIONS]);

  protected readonly filtered = computed(() => {
    const { type, channel, lifecycle } = this.filters();

    return this.notifications().filter((n) => {
      if (type !== 'all' && n.type !== type) return false;
      if (channel !== 'all' && n.channel !== channel) return false;

      if (lifecycle === 'active') {
        if (n.lifecycle === 'deleted') return false;
      } else if (lifecycle === 'all') {
        // pass
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

  protected setFilter<K extends keyof ApplicantNotificationFilters>(
    key: K,
    value: ApplicantNotificationFilters[K],
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
