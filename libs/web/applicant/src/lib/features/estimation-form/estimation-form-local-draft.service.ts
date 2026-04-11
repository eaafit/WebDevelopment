import { Injectable } from '@angular/core';
import type { EstimationFormDraftData } from './estimation-form.models';

export interface EstimationFormLocalDraftSnapshot {
  assessmentId: string | null;
  form: EstimationFormDraftData;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class EstimationFormLocalDraftService {
  load(userId: string): EstimationFormLocalDraftSnapshot | null {
    const storage = this.getStorage();
    if (!storage) {
      return null;
    }

    const snapshot = storage.getItem(this.buildStorageKey(userId));
    if (!snapshot) {
      return null;
    }

    try {
      return JSON.parse(snapshot) as EstimationFormLocalDraftSnapshot;
    } catch {
      storage.removeItem(this.buildStorageKey(userId));
      return null;
    }
  }

  save(userId: string, snapshot: EstimationFormLocalDraftSnapshot): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    storage.setItem(this.buildStorageKey(userId), JSON.stringify(snapshot));
  }

  clear(userId: string): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    storage.removeItem(this.buildStorageKey(userId));
  }

  private buildStorageKey(userId: string): string {
    return `notary:applicant:estimation-form:${userId}`;
  }

  private getStorage(): Storage | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    return sessionStorage;
  }
}
