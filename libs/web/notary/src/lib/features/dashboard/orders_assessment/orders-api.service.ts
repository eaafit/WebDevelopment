import { Injectable } from '@angular/core';
import type { AssessmentItem } from '../assessment/assessment';

export type AssessmentOrderStatus = 'Created' | 'Accepted' | 'InReview' | 'Completed' | 'Rejected';

export interface AssessmentOrderStage {
  key: AssessmentOrderStatus;
  label: string;
  date?: string;
}

export interface AssessmentOrder {
  id: string;
  number: string;
  assessmentId: string;
  realEstateObjectId: string;
  address: string;
  applicantName: string;
  status: AssessmentOrderStatus;
  createdAt: string;
  price: number;
  comment?: string;
  stages: AssessmentOrderStage[];
}

const STORAGE_KEY = 'notary-assessment-orders';
const DEFAULT_APPLICANT = 'Иванов Иван Иванович';
const DEFAULT_ORDER_PRICE = 4500;

const STAGE_LABELS: Record<AssessmentOrderStatus, string> = {
  Created: 'Создана',
  Accepted: 'Принята',
  InReview: 'На рассмотрении',
  Completed: 'Завершена',
  Rejected: 'Отклонена',
};

@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  list(): AssessmentOrder[] {
    return this.readOrders().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  createFromAssessment(item: AssessmentItem): AssessmentOrder {
    const orders = this.readOrders();
    const existing = orders.find((order) => order.assessmentId === item.assessment.id);

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const order: AssessmentOrder = {
      id: this.createId(),
      number: this.createOrderNumber(orders.length + 1),
      assessmentId: item.assessment.id,
      realEstateObjectId: item.realEstate.id,
      address: item.assessment.address,
      applicantName: DEFAULT_APPLICANT,
      status: 'Created',
      createdAt: now,
      price: DEFAULT_ORDER_PRICE,
      comment: item.assessment.description,
      stages: this.createStages(now),
    };

    this.writeOrders([order, ...orders]);
    return order;
  }

  delete(id: string): void {
    this.writeOrders(this.readOrders().filter((order) => order.id !== id));
  }

  restoreDemo(): void {
    this.writeOrders([]);
  }

  getStatusLabel(status: AssessmentOrderStatus): string {
    return STAGE_LABELS[status];
  }

  private createStages(createdAt: string): AssessmentOrderStage[] {
    return [
      { key: 'Created', label: STAGE_LABELS.Created, date: createdAt },
      { key: 'Accepted', label: STAGE_LABELS.Accepted },
      { key: 'InReview', label: STAGE_LABELS.InReview },
      { key: 'Completed', label: STAGE_LABELS.Completed },
      { key: 'Rejected', label: STAGE_LABELS.Rejected },
    ];
  }

  private createOrderNumber(index: number): string {
    return `ORD-${String(index).padStart(3, '0')}`;
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  private readOrders(): AssessmentOrder[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as AssessmentOrder[]) : [];
    } catch {
      return [];
    }
  }

  private writeOrders(orders: AssessmentOrder[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  }
}
