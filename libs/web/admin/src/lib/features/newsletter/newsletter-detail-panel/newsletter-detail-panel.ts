import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { NewsletterItem } from '../newsletter.mock';
import type { NewsletterSenderProfile } from '../newsletter-sender-profile.service';

@Component({
  selector: 'lib-newsletter-detail-panel',
  standalone: true,
  imports: [],
  templateUrl: './newsletter-detail-panel.html',
  styleUrl: '../newsletter.scss',
})
export class NewsletterDetailPanelComponent {
  @Input({ required: true }) item!: NewsletterItem;
  @Input() senderProfile: NewsletterSenderProfile | null = null;

  @Output() closePanel = new EventEmitter<void>();
  @Output() resend = new EventEmitter<NewsletterItem>();

  protected readonly visibleRecipientsLimit = 5;

  protected get statusLabel(): string {
    return newsletterStatusLabel(this.item.status);
  }

  protected get formattedDate(): string {
    return formatNewsletterDate(this.item.sentAt);
  }

  protected get preview(): string {
    const text = this.item.previewText.trim();
    return text.length > 200 ? `${text.slice(0, 200)}...` : text;
  }

  protected get visibleRecipients(): string[] {
    return this.item.recipients.slice(0, this.visibleRecipientsLimit);
  }

  protected get hiddenRecipientsCount(): number {
    return Math.max(0, this.item.recipientCount - this.visibleRecipients.length);
  }

  protected get hiddenRecipientsLabel(): string {
    return formatCount(this.hiddenRecipientsCount, ['адрес', 'адреса', 'адресов']);
  }

  protected get recipientsCountLabel(): string {
    return formatCount(this.item.recipientCount, ['получатель', 'получателя', 'получателей']);
  }

  protected close(): void {
    this.closePanel.emit();
  }

  protected repeatSend(): void {
    this.resend.emit(this.item);
  }
}

function newsletterStatusLabel(status: NewsletterItem['status']): string {
  if (status === 'draft') return 'Черновик';
  if (status === 'scheduled') return 'Запланировано';
  return 'Отправлено';
}

function formatNewsletterDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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
