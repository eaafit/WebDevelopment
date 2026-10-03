import { Component, computed, input, output } from '@angular/core';
import type { NewsletterCampaignDetailView } from '../newsletter.models';

@Component({
  selector: 'lib-newsletter-detail-panel',
  standalone: true,
  imports: [],
  templateUrl: './newsletter-detail-panel.html',
  styleUrl: './newsletter-detail-panel.scss',
})
export class NewsletterDetailPanelComponent {
  readonly newsletter = input.required<NewsletterCampaignDetailView>();
  readonly closeRequested = output<void>();
  readonly repeatRequested = output<string>();

  protected readonly firstRecipients = computed(() => this.newsletter().recipients);
  protected readonly previewText = computed(() => {
    const text = this.newsletter().previewText.trim();
    return text.length > 200 ? `${text.slice(0, 200)}...` : text;
  });

  protected readonly hiddenRecipientsCount = computed(() =>
    Math.max(this.newsletter().campaign.recipientsCount - this.firstRecipients().length, 0),
  );

  protected close(): void {
    this.closeRequested.emit();
  }

  protected repeatSend(): void {
    this.repeatRequested.emit(this.newsletter().campaign.id);
  }
}
