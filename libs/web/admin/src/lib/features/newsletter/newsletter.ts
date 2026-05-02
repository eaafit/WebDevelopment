import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NewsletterApiService } from './newsletter-api.service';
import { NewsletterSelectionService } from './newsletter-selection.service';
import type {
  NewsletterCampaignView,
  NewsletterPagination,
  NewsletterRoleFilter,
  NewsletterSubscriberStatusFilter,
  NewsletterSubscriberView,
} from './newsletter.models';

type NewsletterTab = 'subscribers' | 'history';

const PAGE_LIMIT = 10;
const EMPTY_META: NewsletterPagination = {
  totalItems: 0,
  totalPages: 1,
  currentPage: 1,
  perPage: PAGE_LIMIT,
};

@Component({
  selector: 'lib-newsletter',
  standalone: true,
  imports: [],
  templateUrl: './newsletter.html',
  styleUrl: './newsletter.scss',
})
export class Newsletter {
  private readonly api = inject(NewsletterApiService);
  private readonly selection = inject(NewsletterSelectionService);
  private readonly router = inject(Router);

  protected readonly activeTab = signal<NewsletterTab>('subscribers');
  protected readonly query = signal('');
  protected readonly statusFilter = signal<NewsletterSubscriberStatusFilter>('all');
  protected readonly roleFilter = signal<NewsletterRoleFilter>('all');
  protected readonly historyQuery = signal('');

  protected readonly subscribers = signal<NewsletterSubscriberView[]>([]);
  protected readonly subscribersMeta = signal<NewsletterPagination>({ ...EMPTY_META });
  protected readonly campaigns = signal<NewsletterCampaignView[]>([]);
  protected readonly campaignsMeta = signal<NewsletterPagination>({ ...EMPTY_META });

  protected readonly subscriberPage = signal(1);
  protected readonly campaignPage = signal(1);
  protected readonly subscribersLoading = signal(false);
  protected readonly campaignsLoading = signal(false);
  protected readonly statusMessage = signal('Загрузка списка подписчиков и истории рассылок.');

  protected readonly selectedCount = this.selection.selectedCount;
  protected readonly selectedUserIds = this.selection.selectedUserIds;
  protected readonly activeSubscribersOnPage = computed(() =>
    this.subscribers().filter((subscriber) => subscriber.status === 'active'),
  );

  constructor() {
    void this.loadSubscribers();
    void this.loadCampaigns();
  }

  protected setTab(tab: NewsletterTab): void {
    this.activeTab.set(tab);
  }

  protected updateQuery(value: string): void {
    this.query.set(value);
  }

  protected updateHistoryQuery(value: string): void {
    this.historyQuery.set(value);
  }

  protected updateStatusFilter(value: NewsletterSubscriberStatusFilter): void {
    this.statusFilter.set(value);
  }

  protected updateRoleFilter(value: NewsletterRoleFilter): void {
    this.roleFilter.set(value);
  }

  protected applySubscriberFilters(): void {
    this.subscriberPage.set(1);
    void this.loadSubscribers();
  }

  protected resetSubscriberFilters(): void {
    this.query.set('');
    this.statusFilter.set('all');
    this.roleFilter.set('all');
    this.subscriberPage.set(1);
    void this.loadSubscribers();
  }

  protected applyHistoryFilters(): void {
    this.campaignPage.set(1);
    void this.loadCampaigns();
  }

  protected resetHistoryFilters(): void {
    this.historyQuery.set('');
    this.campaignPage.set(1);
    void this.loadCampaigns();
  }

  protected isSelected(userId: string): boolean {
    return this.selection.isSelected(userId);
  }

  protected toggleSubscriber(subscriber: NewsletterSubscriberView): void {
    if (subscriber.status !== 'active') {
      this.statusMessage.set('Отписавшихся пользователей нельзя добавить в аудиторию рассылки.');
      return;
    }
    this.selection.toggle(subscriber.userId);
  }

  protected selectActiveSubscribersOnPage(): void {
    this.selection.addMany(this.activeSubscribersOnPage().map((subscriber) => subscriber.userId));
    this.statusMessage.set(`Выбрано активных подписчиков: ${this.selectedCount()}.`);
  }

  protected clearSelection(): void {
    this.selection.clear();
    this.statusMessage.set('Выбор подписчиков очищен.');
  }

  protected async createCampaignFromSelection(): Promise<void> {
    await this.router.navigate(['/admin', 'newsletter', 'new']);
  }

  protected async createCampaignForAll(): Promise<void> {
    await this.router.navigate(['/admin', 'newsletter', 'new']);
  }

  protected previousSubscribersPage(): void {
    if (this.subscriberPage() <= 1) return;
    this.subscriberPage.update((page) => page - 1);
    void this.loadSubscribers();
  }

  protected nextSubscribersPage(): void {
    if (this.subscriberPage() >= this.subscribersMeta().totalPages) return;
    this.subscriberPage.update((page) => page + 1);
    void this.loadSubscribers();
  }

  protected previousCampaignsPage(): void {
    if (this.campaignPage() <= 1) return;
    this.campaignPage.update((page) => page - 1);
    void this.loadCampaigns();
  }

  protected nextCampaignsPage(): void {
    if (this.campaignPage() >= this.campaignsMeta().totalPages) return;
    this.campaignPage.update((page) => page + 1);
    void this.loadCampaigns();
  }

  private async loadSubscribers(): Promise<void> {
    this.subscribersLoading.set(true);
    try {
      const response = await this.api.listSubscribers({
        page: this.subscriberPage(),
        limit: PAGE_LIMIT,
        query: this.query(),
        status: this.statusFilter(),
        role: this.roleFilter(),
      });
      this.subscribers.set(response.subscribers);
      this.subscribersMeta.set(response.meta);
      this.statusMessage.set(`Подписчиков найдено: ${response.meta.totalItems}.`);
    } catch (error) {
      this.statusMessage.set(errorMessage(error, 'Не удалось загрузить список подписчиков.'));
      this.subscribers.set([]);
      this.subscribersMeta.set({ ...EMPTY_META });
    } finally {
      this.subscribersLoading.set(false);
    }
  }

  private async loadCampaigns(): Promise<void> {
    this.campaignsLoading.set(true);
    try {
      const response = await this.api.listCampaigns({
        page: this.campaignPage(),
        limit: PAGE_LIMIT,
        query: this.historyQuery(),
      });
      this.campaigns.set(response.campaigns);
      this.campaignsMeta.set(response.meta);
    } catch (error) {
      this.statusMessage.set(errorMessage(error, 'Не удалось загрузить историю рассылок.'));
      this.campaigns.set([]);
      this.campaignsMeta.set({ ...EMPTY_META });
    } finally {
      this.campaignsLoading.set(false);
    }
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
