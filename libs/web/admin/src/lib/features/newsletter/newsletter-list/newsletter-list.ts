import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NewsletterDetailPanelComponent } from '../newsletter-detail-panel/newsletter-detail-panel';
import { MOCK_NEWSLETTERS, NewsletterItem } from '../newsletter.mock';

type NewsletterStatusFilter = NewsletterItem['status'] | 'all';

@Component({
  selector: 'lib-newsletter-list',
  standalone: true,
  imports: [NewsletterDetailPanelComponent],
  templateUrl: './newsletter-list.html',
  styleUrl: './newsletter-list.scss',
})
export class NewsletterListComponent {
  private readonly router = inject(Router);

  protected readonly statusFilter = signal<NewsletterStatusFilter>('all');
  protected readonly selectedNewsletter = signal<NewsletterItem | null>(null);
  protected readonly toastMessage = signal<string | null>(null);

  protected readonly newsletters = signal<NewsletterItem[]>([...MOCK_NEWSLETTERS]);

  protected readonly filteredNewsletters = computed(() => {
    const status = this.statusFilter();
    const list = this.newsletters();

    if (status === 'all') return list;

    return list.filter((item) => item.status === status);
  });

  protected readonly statusLabels: Record<NewsletterItem['status'], string> = {
    sent: 'Отправлено',
    draft: 'Черновик',
    scheduled: 'Запланировано',
  };

  protected readonly statusFilterLabel = computed(() => {
    const status = this.statusFilter();
    return status === 'all' ? 'Все' : this.statusLabels[status];
  });

  protected updateStatusFilter(value: NewsletterStatusFilter): void {
    this.statusFilter.set(value);
  }

  protected createNewsletter(): void {
    this.router.navigate(['/admin/newsletter/new']);
  }

  protected selectNewsletter(item: NewsletterItem): void {
    this.selectedNewsletter.set(item);
  }

  protected closeDetails(): void {
    this.selectedNewsletter.set(null);
  }

  protected resendNewsletter(item: NewsletterItem): void {
    this.toastMessage.set(`Рассылка «${item.subject}» повторно отправлена (mock).`);
    window.setTimeout(() => this.toastMessage.set(null), 3200);
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  protected isSelected(item: NewsletterItem): boolean {
    return this.selectedNewsletter()?.id === item.id;
  }
}
