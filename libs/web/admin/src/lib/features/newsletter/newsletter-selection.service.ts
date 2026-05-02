import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NewsletterSelectionService {
  private readonly selectedUserIdsState = signal<Set<string>>(new Set());

  readonly selectedUserIds = computed(() => Array.from(this.selectedUserIdsState()));
  readonly selectedCount = computed(() => this.selectedUserIdsState().size);

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
}
