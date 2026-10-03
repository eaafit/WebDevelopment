import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NewsletterDetailPanelComponent } from '../newsletter-detail-panel/newsletter-detail-panel';
import { NewsletterApiService } from '../newsletter-api.service';
import type {
  NewsletterCampaignDetailView,
  NewsletterCampaignStatus,
  NewsletterCampaignStatusFilter,
  NewsletterCampaignView,
  NewsletterPagination,
} from '../newsletter.models';

const PAGE_LIMIT = 20;
const EMPTY_META: NewsletterPagination = {
  totalItems: 0,
  totalPages: 1,
  currentPage: 1,
  perPage: PAGE_LIMIT,
};

@Component({
  selector: 'lib-newsletter-list',
  standalone: true,
  imports: [NewsletterDetailPanelComponent],
  templateUrl: './newsletter-list.html',
  styleUrl: './newsletter-list.scss',
})
export class NewsletterListComponent {
  private readonly api = inject(NewsletterApiService);
  private readonly router = inject(Router);

  protected readonly statusFilter = signal<NewsletterCampaignStatusFilter>('all');
  protected readonly selectedNewsletter = signal<NewsletterCampaignDetailView | null>(null);
  protected readonly toastMessage = signal('');
  protected readonly statusMessage = signal('Загрузка журнала рассылок.');
  protected readonly newsletters = signal<NewsletterCampaignView[]>([]);
  protected readonly meta = signal<NewsletterPagination>({ ...EMPTY_META });
  protected readonly page = signal(1);
  protected readonly loading = signal(false);

  protected readonly totalLabel = computed(() => this.meta().totalItems || this.newsletters().length);

  constructor() {
    void this.loadNewsletters();
  }

  protected updateStatusFilter(value: string): void {
    this.statusFilter.set(value as NewsletterCampaignStatusFilter);
    this.page.set(1);
    void this.loadNewsletters();
  }

  protected async selectNewsletter(newsletter: NewsletterCampaignView): Promise<void> {
    try {
      this.selectedNewsletter.set(await this.api.getCampaign(newsletter.id));
    } catch (error) {
      this.statusMessage.set(errorMessage(error, 'Не удалось загрузить детали рассылки.'));
    }
  }

  protected closeDetailPanel(): void {
    this.selectedNewsletter.set(null);
  }

  protected async repeatNewsletter(id: string): Promise<void> {
    try {
      const repeatedNewsletter = await this.api.repeatCampaign(id);
      await this.loadNewsletters();
      this.selectedNewsletter.set(await this.api.getCampaign(repeatedNewsletter.id));
      this.showToast(`Рассылка повторно отправлена ${repeatedNewsletter.recipientsCount} получателям.`);
    } catch (error) {
      this.statusMessage.set(errorMessage(error, 'Не удалось выполнить повторную отправку.'));
    }
  }

  protected previousPage(): void {
    if (this.page() <= 1) return;
    this.page.update((page) => page - 1);
    void this.loadNewsletters();
  }

  protected nextPage(): void {
    if (this.page() >= this.meta().totalPages) return;
    this.page.update((page) => page + 1);
    void this.loadNewsletters();
  }

  protected async loadNewsletters(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.api.listCampaigns({
        page: this.page(),
        limit: PAGE_LIMIT,
        query: '',
        status: this.statusFilter(),
      });
      this.newsletters.set(response.campaigns);
      this.meta.set(response.meta);
      this.statusMessage.set(`Загружено кампаний: ${response.meta.totalItems}.`);
    } catch (error) {
      this.newsletters.set([]);
      this.meta.set({ ...EMPTY_META });
      this.statusMessage.set(errorMessage(error, 'Не удалось загрузить журнал рассылок.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async createNewsletter(): Promise<void> {
    await this.router.navigate(['/admin/newsletter/new']);
  }

  protected statusClass(status: NewsletterCampaignStatus): string {
    return `newsletter-list__badge--${status}`;
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    window.setTimeout(() => this.toastMessage.set(''), 3000);
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
