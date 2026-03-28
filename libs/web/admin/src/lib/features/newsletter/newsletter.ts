import { Component, computed, inject, signal } from '@angular/core';
import { NewsletterUiStoreService } from './newsletter-ui-store.service';

type NewsletterTab = 'list' | 'new' | 'groups' | 'history';

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

type AudienceMode = 'all' | 'byRole' | 'selected' | 'group';

interface SubscriberGroup {
  id: string;
  name: string;
  description: string;
  emails: string[];
  isActive: boolean;
  updatedAt: string;
}

interface GroupFormState {
  name: string;
  description: string;
  emailsInput: string;
  isActive: boolean;
}

interface NewsletterCampaign {
  id: string;
  createdAt: string;
  subject: string;
  audienceLabel: string;
  smtpLabel: string;
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

const DEFAULT_GROUP_FORM: GroupFormState = {
  name: '',
  description: '',
  emailsInput: '',
  isActive: true,
};

const INITIAL_SUBSCRIBER_GROUPS: SubscriberGroup[] = [
  {
    id: 'group-001',
    name: 'Нотариусы (активные)',
    description: 'Актуальная группа рассылки для нотариусов.',
    emails: ['notary@example.com', 'notary2@example.com', 'notary3@example.com'],
    isActive: true,
    updatedAt: '28.03.2026, 12:05',
  },
  {
    id: 'group-002',
    name: 'Заявители — март',
    description: 'Статическая выборка заявителей за март 2026.',
    emails: ['applicant@example.com', 'applicant2@example.com'],
    isActive: true,
    updatedAt: '27.03.2026, 16:42',
  },
  {
    id: 'group-003',
    name: 'Архивная группа',
    description: 'Группа отключена и не используется в новых рассылках.',
    emails: ['old-list@example.com'],
    isActive: false,
    updatedAt: '20.03.2026, 09:10',
  },
];

const CAMPAIGNS: NewsletterCampaign[] = [
  {
    id: 'c-2026-02-28-001',
    createdAt: '2026-02-28 11:35',
    subject: 'Обновление тарифных планов для нотариусов',
    audienceLabel: 'Роль: Нотариус',
    smtpLabel: 'Основной SMTP (SendGrid)',
    recipientsCount: 42,
    status: 'sent',
  },
  {
    id: 'c-2026-02-20-001',
    createdAt: '2026-02-20 16:10',
    subject: 'Запуск сервиса нотариальной оценки',
    audienceLabel: 'Все подписчики',
    smtpLabel: 'Резервный SMTP (Yandex)',
    recipientsCount: 128,
    status: 'sent',
  },
  {
    id: 'c-2026-03-05-001',
    createdAt: '2026-03-05 09:00',
    subject: 'Плановое обслуживание системы',
    audienceLabel: 'Роль: Администратор',
    smtpLabel: 'Основной SMTP (SendGrid)',
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
  private readonly uiStore = inject(NewsletterUiStoreService);

  protected readonly activeTab = signal<NewsletterTab>('list');

  protected readonly filters = signal<NewsletterFilters>({ ...DEFAULT_FILTERS });
  protected readonly selectedIds = signal<Set<string>>(new Set());

  protected readonly audienceMode = signal<AudienceMode>('all');
  protected readonly audienceRole = signal<'Нотариус' | 'Заявитель' | 'Администратор'>('Нотариус');
  protected readonly selectedGroupId = signal<string>('');
  protected readonly smtpClientId = signal<string>(this.uiStore.activeSmtpClients()[0]?.id ?? '');

  protected readonly subject = signal<string>('');
  protected readonly body = signal<string>('');
  protected readonly addCta = signal<boolean>(true);

  protected readonly groupFilterQuery = signal<string>('');
  protected readonly editingGroupId = signal<string | null>(null);
  protected readonly groupForm = signal<GroupFormState>({ ...DEFAULT_GROUP_FORM });

  protected readonly statusMessage = signal<string>(
    'Выберите подписчиков или перейдите к созданию новой рассылки.',
  );

  protected readonly availableSmtpClients = this.uiStore.activeSmtpClients;

  protected readonly subscriberGroups = signal<SubscriberGroup[]>([...INITIAL_SUBSCRIBER_GROUPS]);

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

  protected readonly isGroupEditing = computed(() => this.editingGroupId() !== null);

  protected readonly selectedSmtpClient = computed(() =>
    this.availableSmtpClients().find((client) => client.id === this.smtpClientId()),
  );

  protected readonly activeSubscriberGroups = computed(() =>
    this.subscriberGroups().filter((group) => group.isActive),
  );

  protected readonly filteredSubscriberGroups = computed(() => {
    const query = this.groupFilterQuery().trim().toLowerCase();
    if (!query) return this.subscriberGroups();

    return this.subscriberGroups().filter((group) => {
      const haystack = `${group.name} ${group.description} ${group.emails.join(' ')}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  protected readonly selectedGroup = computed(() =>
    this.subscriberGroups().find((group) => group.id === this.selectedGroupId()),
  );

  protected readonly campaigns = signal<NewsletterCampaign[]>([...CAMPAIGNS]);

  protected setTab(tab: NewsletterTab): void {
    this.activeTab.set(tab);
    switch (tab) {
      case 'list':
        this.statusMessage.set('Список подписчиков загружен (демонстрационные данные).');
        break;
      case 'new':
        this.ensureSmtpSelection();
        this.ensureGroupSelection();
        this.statusMessage.set('Форма создания рассылки. Действия пока работают как стабы.');
        break;
      case 'groups':
        this.statusMessage.set(
          'Управление статическими группами подписчиков. Можно создавать, редактировать и удалять группы.',
        );
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

    if (mode === 'group') {
      this.ensureGroupSelection();

      if (!this.activeSubscriberGroups().length) {
        this.statusMessage.set(
          'Нет активных групп подписчиков. Создайте группу во вкладке «Группы».',
        );
      }
    }
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

  protected setSmtpClientId(value: string): void {
    this.smtpClientId.set(value);
  }

  protected setSelectedGroupId(value: string): void {
    this.selectedGroupId.set(value);
  }

  protected toggleCta(checked: boolean): void {
    this.addCta.set(checked);
  }

  protected updateGroupFilterQuery(value: string): void {
    this.groupFilterQuery.set(value);
  }

  protected updateGroupForm<K extends keyof GroupFormState>(
    key: K,
    value: GroupFormState[K],
  ): void {
    this.groupForm.update((prev) => ({ ...prev, [key]: value }));
  }

  protected startCreateGroup(): void {
    this.editingGroupId.set(null);
    this.groupForm.set({ ...DEFAULT_GROUP_FORM });
  }

  protected startEditGroup(group: SubscriberGroup): void {
    this.editingGroupId.set(group.id);
    this.groupForm.set({
      name: group.name,
      description: group.description,
      emailsInput: group.emails.join('\n'),
      isActive: group.isActive,
    });
    this.statusMessage.set(`Редактирование группы «${group.name}».`);
  }

  protected saveGroup(): void {
    const form = this.groupForm();
    const name = form.name.trim();
    const description = form.description.trim();

    if (!name) {
      this.statusMessage.set('Укажите название группы подписчиков.');
      return;
    }

    const parsed = this.parseGroupEmails(form.emailsInput);

    if (!parsed.emails.length) {
      this.statusMessage.set('Добавьте хотя бы один email в группу подписчиков.');
      return;
    }

    if (parsed.invalid.length) {
      this.statusMessage.set(
        `Найдены невалидные email: ${parsed.invalid.slice(0, 3).join(', ')}${parsed.invalid.length > 3 ? '…' : ''}`,
      );
      return;
    }

    const editingId = this.editingGroupId();

    if (editingId) {
      this.subscriberGroups.update((groups) =>
        groups.map((group) =>
          group.id === editingId
            ? {
                ...group,
                name,
                description,
                emails: parsed.emails,
                isActive: form.isActive,
                updatedAt: this.formatDateTime(),
              }
            : group,
        ),
      );

      if (!form.isActive && this.selectedGroupId() === editingId) {
        const fallback = this.activeSubscriberGroups().find((group) => group.id !== editingId);
        this.selectedGroupId.set(fallback?.id ?? '');
      }

      this.statusMessage.set(`Группа «${name}» обновлена.`);
      this.startCreateGroup();
      return;
    }

    const nextGroup: SubscriberGroup = {
      id: this.generateGroupId(),
      name,
      description,
      emails: parsed.emails,
      isActive: form.isActive,
      updatedAt: this.formatDateTime(),
    };

    this.subscriberGroups.update((groups) => [nextGroup, ...groups]);

    if (nextGroup.isActive && !this.selectedGroupId()) {
      this.selectedGroupId.set(nextGroup.id);
    }

    this.statusMessage.set(`Группа «${name}» создана.`);
    this.startCreateGroup();
  }

  protected toggleGroupStatus(group: SubscriberGroup): void {
    this.subscriberGroups.update((groups) =>
      groups.map((item) =>
        item.id === group.id
          ? {
              ...item,
              isActive: !item.isActive,
              updatedAt: this.formatDateTime(),
            }
          : item,
      ),
    );

    if (group.isActive && this.selectedGroupId() === group.id) {
      const fallback = this.activeSubscriberGroups().find((item) => item.id !== group.id);
      this.selectedGroupId.set(fallback?.id ?? '');
    }

    this.statusMessage.set(
      group.isActive ? `Группа «${group.name}» отключена.` : `Группа «${group.name}» активирована.`,
    );
  }

  protected removeGroup(group: SubscriberGroup): void {
    this.subscriberGroups.update((groups) => groups.filter((item) => item.id !== group.id));

    if (this.selectedGroupId() === group.id) {
      this.selectedGroupId.set(this.activeSubscriberGroups()[0]?.id ?? '');
    }

    if (this.editingGroupId() === group.id) {
      this.startCreateGroup();
    }

    this.statusMessage.set(`Группа «${group.name}» удалена.`);
  }

  protected useGroupForCampaign(group: SubscriberGroup): void {
    this.selectedGroupId.set(group.id);
    this.setAudienceMode('group');
    this.setTab('new');
    this.statusMessage.set(`Для рассылки выбрана группа «${group.name}».`);
  }

  protected openPreview(): void {
    this.statusMessage.set(
      'Предпросмотр письма пока работает как UI-стаб. Здесь будет модальное окно с шаблоном письма.',
    );
  }

  protected sendCampaign(): void {
    this.ensureSmtpSelection();

    const smtpClient = this.selectedSmtpClient();
    if (!smtpClient) {
      this.statusMessage.set(
        'Выберите активный SMTP-клиент перед отправкой. Настроить профили можно в разделе «Настройки».',
      );
      return;
    }

    const audienceLabel = this.buildAudienceLabel();
    const subject = this.subject().trim() || 'Без темы';
    const body = this.body().trim();

    if (!body) {
      this.statusMessage.set('Тело письма пустое. Добавьте текст перед отправкой.');
      return;
    }

    if (this.audienceMode() === 'selected' && this.selectedCount() === 0) {
      this.statusMessage.set('Для ручного режима аудитории выберите хотя бы одного подписчика.');
      return;
    }

    if (this.audienceMode() === 'group') {
      const group = this.selectedGroup();

      if (!group || !group.isActive) {
        this.statusMessage.set(
          'Выберите активную группу подписчиков для режима «Группа подписчиков».',
        );
        return;
      }

      if (!group.emails.length) {
        this.statusMessage.set('Выбранная группа не содержит email-адресов.');
        return;
      }
    }

    const recipientsCount = this.estimateRecipientsCount();
    if (!recipientsCount) {
      this.statusMessage.set(
        'Не удалось определить получателей. Проверьте выбранный режим аудитории.',
      );
      return;
    }

    const next: NewsletterCampaign = {
      id: `c-${new Date().toISOString()}`,
      createdAt: new Date().toLocaleString('ru-RU'),
      subject,
      audienceLabel,
      smtpLabel: smtpClient.name,
      recipientsCount,
      status: 'scheduled',
    };

    this.campaigns.update((list) => [next, ...list]);
    this.statusMessage.set(
      `Рассылка поставлена в очередь (демо-стаб): SMTP «${smtpClient.name}», получателей ${recipientsCount}.`,
    );
  }

  private buildAudienceLabel(): string {
    const mode = this.audienceMode();
    if (mode === 'all') return 'Все подписчики';
    if (mode === 'byRole') return `Роль: ${this.audienceRole()}`;
    if (mode === 'group') {
      const group = this.selectedGroup();
      return group ? `Группа: ${group.name}` : 'Группа: не выбрана';
    }
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

    if (mode === 'group') {
      return this.selectedGroup()?.emails.length ?? 0;
    }

    return this.selectedCount() || 0;
  }

  private ensureSmtpSelection(): void {
    if (this.selectedSmtpClient()) return;

    const firstActive = this.availableSmtpClients()[0];
    this.smtpClientId.set(firstActive?.id ?? '');
  }

  private ensureGroupSelection(): void {
    const current = this.selectedGroup();
    if (current && current.isActive) return;

    this.selectedGroupId.set(this.activeSubscriberGroups()[0]?.id ?? '');
  }

  private parseGroupEmails(raw: string): { emails: string[]; invalid: string[] } {
    const normalized = raw
      .split(/[\n,; ]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const unique = Array.from(new Set(normalized));
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const email of unique) {
      if (this.isValidEmail(email)) {
        valid.push(email);
      } else {
        invalid.push(email);
      }
    }

    return { emails: valid, invalid };
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private formatDateTime(): string {
    return new Date().toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private generateGroupId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `group-${crypto.randomUUID()}`;
    }

    return `group-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }
}
