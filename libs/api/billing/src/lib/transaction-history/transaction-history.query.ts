import type { PaymentStatus, PaymentType } from '@notary-portal/api-contracts';

export interface TransactionHistoryQuery {
  userId?: string;
  page: number;
  limit: number;
  searchQuery?: string;
  statuses?: PaymentStatus[];
  types?: PaymentType[];
  dateFrom?: Date;
  dateTo?: Date;
}
