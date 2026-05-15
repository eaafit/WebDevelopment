import { Injectable } from '@angular/core';
import type { EstimationFormDraftData } from './estimation-form.models';

export interface EstimationFormLocalDraftSnapshot {
  assessmentId: string | null;
  form: EstimationFormDraftData;
  updatedAt: string;
}

const COMPLETED_ASSESSMENTS_LIMIT = 20;

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

  markCompleted(userId: string, assessmentId: string): void {
    const storage = this.getStorage();
    const normalizedAssessmentId = assessmentId.trim();
    if (!storage || !normalizedAssessmentId) {
      return;
    }

    const completedAssessmentIds = this.loadCompletedAssessmentIds(storage, userId).filter(
      (id) => id !== normalizedAssessmentId,
    );

    storage.setItem(
      this.buildCompletedStorageKey(userId),
      JSON.stringify(
        [normalizedAssessmentId, ...completedAssessmentIds].slice(0, COMPLETED_ASSESSMENTS_LIMIT),
      ),
    );
  }

  isCompleted(userId: string, assessmentId: string): boolean {
    const storage = this.getStorage();
    const normalizedAssessmentId = assessmentId.trim();
    if (!storage || !normalizedAssessmentId) {
      return false;
    }

    return this.loadCompletedAssessmentIds(storage, userId).includes(normalizedAssessmentId);
  }

  private buildStorageKey(userId: string): string {
    return `notary:applicant:estimation-form:${userId}`;
  }

  private buildCompletedStorageKey(userId: string): string {
    return `${this.buildStorageKey(userId)}:completed`;
  }

  private loadCompletedAssessmentIds(storage: Storage, userId: string): string[] {
    const storageKey = this.buildCompletedStorageKey(userId);
    const rawValue = storage.getItem(storageKey);
    if (!rawValue) {
      return [];
    }

    try {
      const parsedValue: unknown = JSON.parse(rawValue);
      if (Array.isArray(parsedValue)) {
        return parsedValue.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      storage.removeItem(storageKey);
    }

    return [];
  }

  private getStorage(): Storage | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    return sessionStorage;
  }
}
