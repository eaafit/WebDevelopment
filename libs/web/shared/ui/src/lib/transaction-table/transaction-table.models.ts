export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export type TransactionType = 'subscription' | 'assessment' | 'document_copy';

export interface TransactionItem {
  id: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
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

export interface TransactionPageMeta {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  perPage: number;
}

export interface TransactionHistoryPage {
  transactions: TransactionItem[];
  meta: TransactionPageMeta | null;
}

export interface TransactionTableFilters {
  searchQuery: string;
  status: TransactionStatus | 'all';
  dateFrom: string;
  dateTo: string;
}
