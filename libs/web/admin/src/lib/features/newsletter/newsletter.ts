import { Component, computed, signal } from '@angular/core';

type NewsletterTab = 'list' | 'new' | 'history';

interface NewsletterSubscriber {
  id: string;
  email: string;
  fullName: string;
  role: 'Нотариус' | 'Заявитель' | 'Администратор';
  subscribedAt: string;
  status: 'active' | 'unsubscribed';
}

interface NewsletterFilters {
  query: string;
  status: 'all' | 'active' | 'unsubscribed';
  role: 'all' | 'Нотариус' | 'Заявитель' | 'Администратор';
}

type AudienceMode = 'all' | 'byRole' | 'selected';

interface NewsletterCampaign {
  id: string;
  createdAt: string;
  subject: string;
  audienceLabel: string;
  recipientsCount: number;
  status: 'scheduled' | 'sent' | 'draft';
}

const SUBSCRIBERS: NewsletterSubscriber[] = [
  {
    id: 's-001',
    email: 'applicant@example.com',
    fullName: 'Иванова София',
    role: 'Заявитель',
    subscribedAt: '2026-02-10',
    status: 'active',
  },
  {
    id: 's-002',
    email: 'notary@example.com',
    fullName: 'Еременко Анастасия',
    role: 'Нотариус',
    subscribedAt: '2026-02-08',
    status: 'active',
  },
  {
    id: 's-003',
    email: 'admin@example.com',
    fullName: 'Деркач Е.С.',
    role: 'Администратор',
    subscribedAt: '2026-02-01',
    status: 'active',
  },
  {
    id: 's-004',
    email: 'user4@example.com',
    fullName: 'Клиент, отписавшийся от рассылки',
    role: 'Заявитель',
    subscribedAt: '2026-01-20',
    status: 'unsubscribed',
  },
];

const DEFAULT_FILTERS: NewsletterFilters = {
  query: '',
  status: 'all',
  role: 'all',
};

const CAMPAIGNS: NewsletterCampaign[] = [
  {
    id: 'c-2026-02-28-001',
    createdAt: '2026-02-28 11:35',
    subject: 'Обновление тарифных планов для нотариусов',
    audienceLabel: 'Роль: Нотариус',
    recipientsCount: 42,
    status: 'sent',
  },
  {
    id: 'c-2026-02-20-001',
    createdAt: '2026-02-20 16:10',
    subject: 'Запуск сервиса нотариальной оценки',
    audienceLabel: 'Все подписчики',
    recipientsCount: 128,
    status: 'sent',
  },
  {
    id: 'c-2026-03-05-001',
    createdAt: '2026-03-05 09:00',
    subject: 'Плановое обслуживание системы',
    audienceLabel: 'Роль: Администратор',
    recipientsCount: 3,
    status: 'scheduled',
  },
];

@Component({
  selector: 'lib-newsletter',
  standalone: true,
  imports: [],
  templateUrl: './newsletter.html',
  styleUrl: './newsletter.scss',
})
export class Newsletter {
  protected readonly activeTab = signal<NewsletterTab>('list');

  protected readonly filters = signal<NewsletterFilters>({ ...DEFAULT_FILTERS });
  protected readonly selectedIds = signal<Set<string>>(new Set());

  protected readonly audienceMode = signal<AudienceMode>('all');
  protected readonly audienceRole = signal<'Нотариус' | 'Заявитель' | 'Администратор'>('Нотариус');

  protected readonly subject = signal<string>('');
  protected readonly body = signal<string>('');
  protected readonly addCta = signal<boolean>(true);

  protected readonly statusMessage = signal<string>(
    'Выберите подписчиков или перейдите к созданию новой рассылки.',
  );

  protected readonly filteredSubscribers = computed(() => {
    const { query, role, status } = this.filters();
    const q = query.trim().toLowerCase();

    return SUBSCRIBERS.filter((s) => {
      if (role !== 'all' && s.role !== role) return false;
      if (status !== 'all' && s.status !== status) return false;

      if (!q) return true;

      const haystack = `${s.email} ${s.fullName}`.toLowerCase();
      return haystack.includes(q);
    });
  });

  protected readonly selectedCount = computed(() => this.selectedIds().size);

  protected readonly campaigns = signal<NewsletterCampaign[]>([...CAMPAIGNS]);

  protected setTab(tab: NewsletterTab): void {
    this.activeTab.set(tab);
    switch (tab) {
      case 'list':
        this.statusMessage.set('Список подписчиков загружен (демонстрационные данные).');
        break;
      case 'new':
        this.statusMessage.set('Форма создания рассылки. Действия пока работают как стабы.');
        break;
      case 'history':
        this.statusMessage.set('История рассылок загружается из локального списка.');
        break;
    }
  }

  protected updateFilter<K extends keyof NewsletterFilters>(
    key: K,
    value: NewsletterFilters[K],
  ): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
  }

  protected resetFilters(): void {
    this.filters.set({ ...DEFAULT_FILTERS });
    this.statusMessage.set('Фильтры очищены.');
  }

  protected toggleSubscriber(id: string): void {
    this.selectedIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  protected selectAllCurrentPage(): void {
    const current = this.filteredSubscribers();
    this.selectedIds.update(
      (prev) =>
        new Set([...prev, ...current.filter((s) => s.status === 'active').map((s) => s.id)]),
    );
    this.statusMessage.set(
      `Выбраны все активные подписчики на текущей выборке (${this.selectedCount()} шт.).`,
    );
  }

  protected clearSelection(): void {
    this.selectedIds.set(new Set());
    this.statusMessage.set('Выбор подписчиков очищен.');
  }

  protected setAudienceMode(mode: AudienceMode): void {
    this.audienceMode.set(mode);
  }

  protected setAudienceRole(role: 'Нотариус' | 'Заявитель' | 'Администратор'): void {
    this.audienceRole.set(role);
  }

  protected updateSubject(value: string): void {
    this.subject.set(value);
  }

  protected updateBody(value: string): void {
    this.body.set(value);
  }

  protected toggleCta(checked: boolean): void {
    this.addCta.set(checked);
  }

  protected openPreview(): void {
    this.statusMessage.set(
      'Предпросмотр письма пока работает как UI-стаб. Здесь будет модальное окно с шаблоном письма.',
    );
  }

  protected sendCampaign(): void {
    const audienceLabel = this.buildAudienceLabel();
    const subject = this.subject().trim() || 'Без темы';
    const body = this.body().trim();

    if (!body) {
      this.statusMessage.set('Тело письма пустое. Добавьте текст перед отправкой.');
      return;
    }

    const next: NewsletterCampaign = {
      id: `c-${new Date().toISOString()}`,
      createdAt: new Date().toLocaleString('ru-RU'),
      subject,
      audienceLabel,
      recipientsCount: this.estimateRecipientsCount(),
      status: 'scheduled',
    };

    this.campaigns.update((list) => [next, ...list]);
    this.statusMessage.set(
      'Рассылка поставлена в очередь (демо-стаб). Настоящая отправка будет настроена после интеграции с backend.',
    );
  }

  private buildAudienceLabel(): string {
    const mode = this.audienceMode();
    if (mode === 'all') return 'Все подписчики';
    if (mode === 'byRole') return `Роль: ${this.audienceRole()}`;
    return `Выбранные вручную (${this.selectedCount()} получателей)`;
  }

  private estimateRecipientsCount(): number {
    const mode = this.audienceMode();
    if (mode === 'all') {
      return SUBSCRIBERS.filter((s) => s.status === 'active').length;
    }
    if (mode === 'byRole') {
      const role = this.audienceRole();
      return SUBSCRIBERS.filter((s) => s.status === 'active' && s.role === role).length;
    }
    return this.selectedCount() || 0;
  }
}
