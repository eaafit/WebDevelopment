import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NewsletterItem } from '../newsletter.mock';

@Component({
  selector: 'lib-newsletter-detail-panel',
  standalone: true,
  imports: [],
  templateUrl: './newsletter-detail-panel.html',
  styleUrl: './newsletter-detail-panel.scss',
})
export class NewsletterDetailPanelComponent {
  @Input({ required: true }) newsletter!: NewsletterItem;

  @Output() readonly closePanel = new EventEmitter<void>();
  @Output() readonly resend = new EventEmitter<NewsletterItem>();

  protected readonly statusLabels: Record<NewsletterItem['status'], string> = {
    sent: 'Отправлено',
    draft: 'Черновик',
    scheduled: 'Запланировано',
  };

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  protected firstRecipients(): string[] {
    return this.newsletter.recipients.slice(0, 5);
  }

  protected clippedPreview(): string {
    const text = this.newsletter.previewText.trim();
    return text.length > 200 ? `${text.slice(0, 200)}...` : text;
  }

  protected onResend(): void {
    this.resend.emit(this.newsletter);
  }

  protected onClose(): void {
    this.closePanel.emit();
  }
}
