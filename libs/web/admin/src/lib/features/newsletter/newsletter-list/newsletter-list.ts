import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NewsletterApiService } from '../newsletter-api.service';
import { NewsletterDetailPanelComponent } from '../newsletter-detail-panel/newsletter-detail-panel';
import {
  NewsletterSentMessagesService,
  type SentMessageView,
} from '../newsletter-sent-messages.service';
import { MOCK_NEWSLETTERS, type NewsletterItem, type NewsletterItemStatus } from '../newsletter.mock';
import { NewsletterSelectionService } from '../newsletter-selection.service';
import {
  NewsletterSenderProfileService,
  type NewsletterSenderProfile,
} from '../newsletter-sender-profile.service';
import type { NewsletterPagination, NewsletterSubscriberView } from '../newsletter.models';

type NewsletterStatusFilter = 'all' | NewsletterItemStatus;

const SUBSCRIBER_PAGE_LIMIT = 10;
const EMPTY_SUBSCRIBER_META: NewsletterPagination = {
  totalItems: 0,
  totalPages: 1,
  currentPage: 1,
  perPage: SUBSCRIBER_PAGE_LIMIT,
};

@Component({
  selector: 'lib-newsletter-list',
  standalone: true,
  imports: [NewsletterDetailPanelComponent],
  templateUrl: './newsletter-list.html',
  styleUrl: '../newsletter.scss',
})
export class NewsletterListComponent {
  private readonly router = inject(Router);
  private readonly api = inject(NewsletterApiService);
  private readonly selection = inject(NewsletterSelectionService);
  private readonly sentMessagesService = inject(NewsletterSentMessagesService);
  private readonly senderProfileService = inject(NewsletterSenderProfileService);

  protected readonly statusFilter = signal<NewsletterStatusFilter>('all');
  protected readonly newsletters = signal<NewsletterItem[]>(MOCK_NEWSLETTERS);
  protected readonly subscribers = signal<NewsletterSubscriberView[]>([]);
  protected readonly subscribersMeta = signal<NewsletterPagination>({ ...EMPTY_SUBSCRIBER_META });
  protected readonly subscribersLoading = signal(false);
  protected readonly sentMessages = signal<SentMessageView[]>([]);
  protected readonly sentMessagesLoading = signal(false);
  protected readonly sentMessagesConfigured = signal(false);
  protected readonly sentMessagesStatus = signal('Загрузка журнала отправленных писем.');
  protected readonly selectedNewsletter = signal<NewsletterItem | null>(null);
  protected readonly senderProfile = signal<NewsletterSenderProfile | null>(null);
  protected readonly statusMessage = signal('Список рассылок готов к просмотру.');

  protected readonly selectedCount = this.selection.selectedCount;
  protected readonly activeSubscribersOnPage = computed(() =>
    this.subscribers().filter((subscriber) => subscriber.status === 'active'),
  );

  protected readonly displayedNewsletters = computed(() => {
    const messages = this.sentMessages();
    return [...groupSentMessages(messages), ...this.newsletters()];
  });

  protected readonly filteredNewsletters = computed(() => {
    const filter = this.statusFilter();
    if (filter === 'all') return this.displayedNewsletters();
    return this.displayedNewsletters().filter((newsletter) => newsletter.status === filter);
  });

  protected readonly sentCount = computed(
    () => this.displayedNewsletters().filter((newsletter) => newsletter.status === 'sent').length,
  );
  protected readonly draftCount = computed(
    () => this.displayedNewsletters().filter((newsletter) => newsletter.status === 'draft').length,
  );
  protected readonly scheduledCount = computed(
    () =>
      this.displayedNewsletters().filter((newsletter) => newsletter.status === 'scheduled').length,
  );

  constructor() {
    void this.loadSenderProfile();
    void this.loadSubscribers();
    void this.loadSentMessages();
  }

  protected updateStatusFilter(value: NewsletterStatusFilter): void {
    this.statusFilter.set(value);
    this.selectedNewsletter.set(null);
    this.statusMessage.set(`Фильтр применён: ${statusFilterLabel(value)}.`);
  }

  protected openDetails(newsletter: NewsletterItem): void {
    this.selectedNewsletter.set(newsletter);
    this.statusMessage.set(`Открыты детали рассылки «${newsletter.subject}».`);
  }

  protected closeDetails(): void {
    this.selectedNewsletter.set(null);
  }

  protected isSubscriberSelected(userId: string): boolean {
    return this.selection.isSelected(userId);
  }

  protected toggleSubscriber(subscriber: NewsletterSubscriberView): void {
    if (subscriber.status !== 'active') {
      this.statusMessage.set('Отписавшихся пользователей нельзя добавить в аудиторию рассылки.');
      return;
    }

    this.selection.toggle(subscriber.userId);
    this.statusMessage.set(`Выбрано получателей: ${this.selectedCount()}.`);
  }

  protected selectActiveSubscribersOnPage(): void {
    this.selection.addMany(this.activeSubscribersOnPage().map((subscriber) => subscriber.userId));
    this.statusMessage.set(`Выбрано получателей: ${this.selectedCount()}.`);
  }

  protected clearSubscriberSelection(): void {
    this.selection.clear();
    this.statusMessage.set('Выбор получателей очищен.');
  }

  protected async createNewsletter(): Promise<void> {
    await this.router.navigate(['/admin/newsletter/new']);
  }

  protected refreshSentMessages(): void {
    void this.loadSentMessages();
  }

  protected resendNewsletter(newsletter: NewsletterItem): void {
    this.statusMessage.set(
      `Повторная отправка письма «${newsletter.subject}» поставлена в очередь.`,
    );
  }

  protected statusLabel(status: NewsletterItemStatus): string {
    return newsletterStatusLabel(status);
  }

  protected formatDate(value: string): string {
    if (!value) return '—';

    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private async loadSenderProfile(): Promise<void> {
    const profile = await this.senderProfileService.getSenderProfile();
    this.senderProfile.set(profile);
  }

  private async loadSubscribers(): Promise<void> {
    this.subscribersLoading.set(true);
    try {
      const response = await this.api.listSubscribers({
        page: 1,
        limit: SUBSCRIBER_PAGE_LIMIT,
        query: '',
        status: 'all',
        role: 'all',
      });
      this.subscribers.set(response.subscribers);
      this.subscribersMeta.set(response.meta);
    } catch {
      this.subscribers.set(createFallbackSubscribers());
      this.subscribersMeta.set({
        totalItems: 6,
        totalPages: 1,
        currentPage: 1,
        perPage: SUBSCRIBER_PAGE_LIMIT,
      });
      this.statusMessage.set('Список подписчиков временно загружен из резервного набора.');
    } finally {
      this.subscribersLoading.set(false);
    }
  }

  private async loadSentMessages(): Promise<void> {
    this.sentMessagesLoading.set(true);
    try {
      const response = await this.sentMessagesService.listMessages();
      this.sentMessagesConfigured.set(response.configured);
      this.sentMessages.set(response.messages);

      if (!response.configured) {
        this.sentMessagesStatus.set('Backend-журнал писем пока недоступен.');
      } else if (response.error) {
        this.sentMessagesStatus.set(response.error);
      } else if (response.messages.length) {
        const totalItems = groupSentMessages(response.messages).length + this.newsletters().length;
        this.sentMessagesStatus.set(`В журнале писем: ${totalItems}.`);
      } else {
        this.sentMessagesStatus.set(`В журнале писем: ${this.newsletters().length}.`);
      }
    } catch (error) {
      this.sentMessagesConfigured.set(false);
      this.sentMessages.set([]);
      this.sentMessagesStatus.set(errorMessage(error, 'Не удалось загрузить журнал писем.'));
    } finally {
      this.sentMessagesLoading.set(false);
    }
  }
}

function newsletterStatusLabel(status: NewsletterItemStatus): string {
  if (status === 'draft') return 'Черновик';
  if (status === 'scheduled') return 'Запланировано';
  return 'Отправлено';
}

function statusFilterLabel(status: NewsletterStatusFilter): string {
  if (status === 'all') return 'Все статусы';
  return newsletterStatusLabel(status);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function groupSentMessages(messages: SentMessageView[]): NewsletterItem[] {
  const groups = new Map<string, SentMessageView[]>();

  for (const message of messages) {
    const key = [
      message.subject,
      message.fromEmail,
      normalizeBodyPreview(message),
      message.sentAt.slice(0, 16),
    ].join('|');
    groups.set(key, [...(groups.get(key) ?? []), message]);
  }

  return Array.from(groups.values()).map(toNewsletterItemFromSentMessages);
}

function toNewsletterItemFromSentMessages(messages: SentMessageView[]): NewsletterItem {
  const first = messages[0];
  const recipients = Array.from(
    new Set(messages.map((message) => message.toEmail).filter((email) => email.trim())),
  );
  const bodyPreview = normalizeBodyPreview(first);
  const previewUrl = messages.find((message) => message.previewUrl)?.previewUrl ?? null;

  return {
    id: `sent-${first.id}`,
    subject: first.subject || 'Без темы',
    sentAt: first.sentAt,
    recipientCount: recipients.length,
    status: 'sent',
    previewText: bodyPreview || 'Текст письма не указан',
    recipients,
    previewUrl,
  };
}

function normalizeBodyPreview(message: SentMessageView): string {
  const source = message.bodyText?.trim() || stripHtml(message.bodyHtml ?? '');
  return source
    .replace(/^Здравствуйте,\s*[^!]+!\s*/i, '')
    .replace(/\s*—\s*Notary portal\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function createFallbackSubscribers(): NewsletterSubscriberView[] {
  return [
    {
      id: 'fallback-sub-1',
      userId: '11111111-1111-4111-a111-111111111111',
      email: 'notary@example.com',
      fullName: 'Нотариус Тестовый',
      role: 'notary',
      roleLabel: 'Нотариус',
      subscribedAt: '01.03.2026, 10:00',
      unsubscribedAt: '—',
      status: 'active',
      statusLabel: 'Активна',
    },
    {
      id: 'fallback-sub-2',
      userId: '22222222-2222-4222-a222-222222222222',
      email: 'applicant@example.com',
      fullName: 'Заявитель Тестовый',
      role: 'applicant',
      roleLabel: 'Заявитель',
      subscribedAt: '02.03.2026, 11:30',
      unsubscribedAt: '—',
      status: 'active',
      statusLabel: 'Активна',
    },
    {
      id: 'fallback-sub-3',
      userId: '33333333-3333-4333-a333-333333333333',
      email: 'admin@example.com',
      fullName: 'Администратор Тестовый',
      role: 'admin',
      roleLabel: 'Администратор',
      subscribedAt: '03.03.2026, 09:15',
      unsubscribedAt: '—',
      status: 'active',
      statusLabel: 'Активна',
    },
    {
      id: 'fallback-sub-4',
      userId: '44444444-4444-4444-a444-444444444444',
      email: 'old@example.com',
      fullName: 'Отписанный пользователь',
      role: 'applicant',
      roleLabel: 'Заявитель',
      subscribedAt: '01.03.2026, 10:00',
      unsubscribedAt: '10.03.2026, 10:00',
      status: 'unsubscribed',
      statusLabel: 'Отписан',
    },
  ];
}
