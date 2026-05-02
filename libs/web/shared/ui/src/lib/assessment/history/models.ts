// models.ts
export type OrderStatus = 'created' | 'accepted' | 'under_review' | 'completed' | 'rejected';

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
  applicantId: string;
  applicantName: string;
  notaryId?: string;
  notaryName?: string;
  plannedCompletionDate: Date;
  actualCompletionDate?: Date;
  transactionId?: string;
  realEstateObject: RealEstateObjectInfo;
}

export interface RealEstateObjectInfo {
  id: string;
  address: string;
  city?: string;
  area?: number;
  objectType?: string;
  roomsCount?: number;
  floor?: number;
}
