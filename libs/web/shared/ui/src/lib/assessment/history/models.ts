// models.ts
export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface StatusHistoryEntry {
  status: OrderStatus;
  date: Date;
  comment?: string;
}

export interface AssessmentOrder {
  id: string;
  objectAddress: string;
  orderDate: Date;
  status: OrderStatus;
  totalAmount: number;
  statusHistory: StatusHistoryEntry[];
}
