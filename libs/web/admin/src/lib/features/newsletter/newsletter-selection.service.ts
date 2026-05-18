import { Injectable, computed, signal } from '@angular/core';
import type { NewsletterDraftTemplate } from './newsletter.models';

@Injectable({ providedIn: 'root' })
export class NewsletterSelectionService {
  private readonly selectedUserIdsState = signal<Set<string>>(new Set());
  private readonly draftTemplateState = signal<NewsletterDraftTemplate | null>(null);

  readonly selectedUserIds = computed(() => Array.from(this.selectedUserIdsState()));
  readonly selectedCount = computed(() => this.selectedUserIdsState().size);
  readonly draftTemplate = computed(() => this.draftTemplateState());

  isSelected(userId: string): boolean {
    return this.selectedUserIdsState().has(userId);
  }

  toggle(userId: string): void {
    this.selectedUserIdsState.update((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  addMany(userIds: string[]): void {
    this.selectedUserIdsState.update((prev) => new Set([...prev, ...userIds]));
  }

  clear(): void {
    this.selectedUserIdsState.set(new Set());
  }

  setDraftTemplate(template: NewsletterDraftTemplate): void {
    this.draftTemplateState.set(template);
  }

  consumeDraftTemplate(): NewsletterDraftTemplate | null {
    const template = this.draftTemplateState();
    this.draftTemplateState.set(null);
    return template;
  }
}
