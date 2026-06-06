import { Injectable } from '@angular/core';
import {
  INITIAL_CONFIRM_VALUE,
  INITIAL_PROPERTY_VALUE,
  SESSION_STORAGE_KEY,
  type NewOrderFormValues,
} from './new-order-form.models';

interface StoredDraft {
  currentStep: 1 | 2 | 3;
  form: NewOrderFormValues;
}

@Injectable({ providedIn: 'root' })
export class NewOrderFormDraftService {
  load(userId: string): StoredDraft | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    const raw = sessionStorage.getItem(this.buildKey(userId));
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoredDraft;
    } catch {
      return null;
    }
  }

  save(userId: string, draft: StoredDraft): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.setItem(this.buildKey(userId), JSON.stringify(draft));
  }

  clear(userId: string): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.removeItem(this.buildKey(userId));
  }

  createEmptyForm(): NewOrderFormValues {
    return {
      property: { ...INITIAL_PROPERTY_VALUE },
      documents: [],
      confirm: { ...INITIAL_CONFIRM_VALUE },
    };
  }

  private buildKey(userId: string): string {
    return `${SESSION_STORAGE_KEY}:${userId}`;
  }
}
