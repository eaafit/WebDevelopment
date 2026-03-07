export const transactionHistoryStatuses = ['pending', 'completed', 'failed', 'refunded'] as const;

export type TransactionHistoryStatus = (typeof transactionHistoryStatuses)[number];

export const transactionHistoryTypes = ['subscription', 'assessment', 'document_copy'] as const;

export type TransactionHistoryType = (typeof transactionHistoryTypes)[number];

export interface TransactionHistoryFilters {
  searchQuery?: string;
  statuses?: TransactionHistoryStatus[];
  types?: TransactionHistoryType[];
  dateFrom?: string;
  dateTo?: string;
}

export interface TransactionHistoryQuery extends TransactionHistoryFilters {
  userId?: string;
  page?: number;
  limit?: number;
}

export interface TransactionHistoryItem {
  id: string;
  userId: string;
  type: TransactionHistoryType;
  status: TransactionHistoryStatus;
  paymentDate: string;
  transactionId: string | null;
  amount: string;
  currency: string;
  description: string;
  paymentMethod: string | null;
  attachmentFileName: string | null;
  attachmentFileUrl: string | null;
  subscriptionId: string | null;
  assessmentId: string | null;
}

export interface PaginationMeta {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  perPage: number;
}

export interface TransactionHistoryResponse {
  transactions: TransactionHistoryItem[];
  meta: PaginationMeta;
}
