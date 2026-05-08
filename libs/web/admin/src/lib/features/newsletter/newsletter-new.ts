import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NewsletterApiService } from './newsletter-api.service';
import { NewsletterSelectionService } from './newsletter-selection.service';
import type {
  NewsletterAudienceInput,
  NewsletterAudienceMode,
  NewsletterCampaignView,
  NewsletterRoleFilter,
} from './newsletter.models';

type NewsletterRole = Exclude<NewsletterRoleFilter, 'all'>;

@Component({
  selector: 'lib-newsletter-new',
  standalone: true,
  imports: [],
  templateUrl: './newsletter-new.html',
  styleUrl: './newsletter.scss',
})
export class NewsletterNew {
  private readonly api = inject(NewsletterApiService);
  private readonly selection = inject(NewsletterSelectionService);
  private readonly router = inject(Router);

  protected readonly audienceMode = signal<NewsletterAudienceMode>('all');
  protected readonly audienceRole = signal<NewsletterRole>('notary');
  protected readonly subject = signal('');
  protected readonly bodyHtml = signal('');
  protected readonly previewOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly sending = signal(false);
  protected readonly estimating = signal(false);
  protected readonly recipientsCount = signal<number | null>(null);
  protected readonly statusMessage = signal('Составьте письмо и проверьте аудиторию перед отправкой.');
  protected readonly sentCampaign = signal<NewsletterCampaignView | null>(null);

  protected readonly selectedCount = this.selection.selectedCount;
  protected readonly selectedUserIds = this.selection.selectedUserIds;
  protected readonly canSend = computed(() => {
    if (this.sending()) return false;
    if (!this.subject().trim() || !this.bodyHtml().trim()) return false;
    if (this.audienceMode() === 'selected' && this.selectedCount() === 0) return false;
    return true;
  });
  protected readonly selectedAddressLabel = computed(() =>
    formatCount(this.selectedCount(), ['адрес', 'адреса', 'адресов']),
  );

  constructor() {
    if (this.selectedCount() > 0) {
      this.audienceMode.set('selected');
    }
    void this.refreshEstimate();
  }

  protected setAudienceMode(mode: NewsletterAudienceMode): void {
    this.audienceMode.set(mode);
    this.sentCampaign.set(null);
    void this.refreshEstimate();
  }

  protected setAudienceRole(role: NewsletterRole): void {
    this.audienceRole.set(role);
    void this.refreshEstimate();
  }

  protected updateSubject(value: string): void {
    this.subject.set(value);
    this.sentCampaign.set(null);
  }

  protected updateBody(value: string): void {
    this.bodyHtml.set(value);
    this.sentCampaign.set(null);
  }

  protected openPreview(): void {
    if (!this.validateDraft()) return;
    this.previewOpen.set(true);
  }

  protected closePreview(): void {
    this.previewOpen.set(false);
  }

  protected async openConfirm(): Promise<void> {
    if (!this.validateDraft()) return;
    const count = await this.refreshEstimate();
    if (!count) {
      this.statusMessage.set('В выбранной аудитории нет активных подписчиков.');
      return;
    }
    this.confirmOpen.set(true);
  }

  protected closeConfirm(): void {
    if (this.sending()) return;
    this.confirmOpen.set(false);
  }

  protected async sendCampaign(): Promise<void> {
    if (!this.validateDraft()) return;
    this.sending.set(true);
    this.statusMessage.set('Отправка рассылки выполняется. Дождитесь результата.');

    try {
      const campaign = await this.api.sendCampaign({
        audience: this.buildAudience(),
        subject: this.subject(),
        bodyHtml: this.bodyHtml(),
      });
      this.sentCampaign.set(campaign);
      this.confirmOpen.set(false);
      this.selection.clear();
      this.recipientsCount.set(campaign.recipientsCount);
      this.statusMessage.set(
        `Рассылка завершена: доставлено ${campaign.sentCount}, ошибок ${campaign.failedCount}.`,
      );
    } catch (error) {
      this.statusMessage.set(errorMessage(error, 'Не удалось отправить рассылку.'));
    } finally {
      this.sending.set(false);
    }
  }

  protected async backToNewsletter(): Promise<void> {
    await this.router.navigate(['/admin', 'newsletter']);
  }

  private async refreshEstimate(): Promise<number> {
    this.estimating.set(true);
    try {
      const count = await this.api.estimateAudience(this.buildAudience());
      this.recipientsCount.set(count);
      return count;
    } catch (error) {
      this.recipientsCount.set(null);
      this.statusMessage.set(errorMessage(error, 'Не удалось оценить аудиторию.'));
      return 0;
    } finally {
      this.estimating.set(false);
    }
  }

  private buildAudience(): NewsletterAudienceInput {
    return {
      mode: this.audienceMode(),
      role: this.audienceRole(),
      selectedUserIds: this.selectedUserIds(),
    };
  }

  private validateDraft(): boolean {
    if (!this.subject().trim()) {
      this.statusMessage.set('Укажите тему письма.');
      return false;
    }
    if (!this.bodyHtml().trim()) {
      this.statusMessage.set('Добавьте HTML или текст письма.');
      return false;
    }
    if (this.audienceMode() === 'selected' && this.selectedCount() === 0) {
      this.statusMessage.set('Для ручной аудитории выберите подписчиков на странице списка.');
      return false;
    }
    return true;
  }

  protected recipientsCountLabel(count: number | null): string {
    return formatCount(count ?? 0, ['получатель', 'получателя', 'получателей']);
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatCount(count: number, forms: [string, string, string]): string {
  const absCount = Math.abs(count);
  const lastTwoDigits = absCount % 100;
  const lastDigit = absCount % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${count} ${forms[2]}`;
  }

  if (lastDigit === 1) {
    return `${count} ${forms[0]}`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${count} ${forms[1]}`;
  }

  return `${count} ${forms[2]}`;
}
