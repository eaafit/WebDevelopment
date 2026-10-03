import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import {
  PaymentReceiptStatus,
  PaymentStatus,
  PaymentType,
  type GetPaymentHistoryResponse,
  type Payment,
} from '@notary-portal/api-contracts';
import type {
  TransactionHistoryPage,
  TransactionItem,
  TransactionPageMeta,
  TransactionReceiptStatus,
  TransactionStatus,
  TransactionType,
} from '../transaction-table/transaction-table.models';

export interface PaymentHistoryRequestQuery {
  page: number;
  limit: number;
  searchQuery?: string;
  statuses?: PaymentStatus[];
  types?: PaymentType[];
  dateFrom?: string;
  dateTo?: string;
}

export interface PaymentHistoryRecord {
  id: string;
  userId: string;
  type: PaymentType;
  status: PaymentStatus;
  paymentDate: string;
  transactionId: string | null;
  amount: string;
  currency: string;
  description: string;
  paymentMethod: string | null;
  hasReceipt: boolean;
  receiptStatus: PaymentReceiptStatus;
  attachmentFileName: string | null;
  attachmentFileUrl: string | null;
  subscriptionId: string | null;
  assessmentId: string | null;
}

export interface PaymentHistoryRecordsPage {
  payments: PaymentHistoryRecord[];
  meta: TransactionPageMeta | null;
}

export function buildPaymentHistoryRequest(query: PaymentHistoryRequestQuery) {
  const paymentDateRange =
    query.dateFrom || query.dateTo
      ? {
          startDate: query.dateFrom ? toUtcBoundary(query.dateFrom, 'start') : undefined,
          endDate: query.dateTo ? toUtcBoundary(query.dateTo, 'end') : undefined,
        }
      : undefined;

  return {
    pagination: { page: query.page, limit: query.limit },
    filters: {
      searchQuery: query.searchQuery?.trim() ?? '',
      statuses: query.statuses ?? [],
      types: query.types ?? [],
      paymentDateRange,
    },
  };
}

export function toPaymentHistoryPage(
  response: GetPaymentHistoryResponse,
): PaymentHistoryRecordsPage {
  return {
    payments: response.payments.map((payment) => toPaymentHistoryRecord(payment)),
    meta: toPaymentPageMeta(response),
  };
}

export function toTransactionHistoryPage(
  response: GetPaymentHistoryResponse,
): TransactionHistoryPage {
  const page = toPaymentHistoryPage(response);

  return {
    transactions: page.payments.map((payment) => toTransactionItem(payment)),
    meta: page.meta,
  };
}

export function toPaymentHistoryRecord(payment: Payment): PaymentHistoryRecord {
  return {
    id: payment.id,
    userId: payment.userId,
    type: normalizePaymentType(payment.type),
    status: normalizePaymentStatus(payment.status),
    paymentDate: payment.paymentDate ? timestampDate(payment.paymentDate).toISOString() : '',
    transactionId: normalizeOptionalString(payment.transactionId),
    amount: payment.amount?.amount ?? '0',
    currency: payment.amount?.currency ?? 'RUB',
    description: payment.description,
    paymentMethod: normalizeOptionalString(payment.paymentMethod),
    hasReceipt: payment.hasReceipt,
    receiptStatus: payment.receiptStatus,
    attachmentFileName: normalizeOptionalString(payment.attachmentFileName),
    attachmentFileUrl: normalizeOptionalString(payment.attachmentFileUrl),
    subscriptionId: normalizeOptionalString(payment.subscriptionId),
    assessmentId: normalizeOptionalString(payment.assessmentId),
  };
}

export function toTransactionItem(payment: PaymentHistoryRecord): TransactionItem {
  return {
    id: payment.id,
    userId: payment.userId,
    type: fromRpcPaymentType(payment.type),
    status: fromRpcPaymentStatus(payment.status),
    paymentDate: payment.paymentDate,
    transactionId: payment.transactionId,
    amount: payment.amount,
    currency: payment.currency,
    description: payment.description,
    paymentMethod: payment.paymentMethod,
    hasReceipt: payment.hasReceipt,
    receiptStatus: fromRpcPaymentReceiptStatus(payment.receiptStatus),
    attachmentFileName: payment.attachmentFileName,
    attachmentFileUrl: payment.attachmentFileUrl,
    subscriptionId: payment.subscriptionId,
    assessmentId: payment.assessmentId,
  };
}

export function toRpcPaymentStatus(status: TransactionStatus): PaymentStatus {
  const map: Record<TransactionStatus, PaymentStatus> = {
    pending: PaymentStatus.PENDING,
    completed: PaymentStatus.COMPLETED,
    failed: PaymentStatus.FAILED,
    refunded: PaymentStatus.REFUNDED,
  };

  return map[status];
}

export function fromRpcPaymentStatus(status: PaymentStatus): TransactionStatus {
  switch (status) {
    case PaymentStatus.COMPLETED:
      return 'completed';
    case PaymentStatus.FAILED:
      return 'failed';
    case PaymentStatus.REFUNDED:
      return 'refunded';
    case PaymentStatus.PENDING:
    case PaymentStatus.UNSPECIFIED:
    default:
      return 'pending';
  }
}

export function toRpcPaymentType(type: TransactionType): PaymentType {
  const map: Record<TransactionType, PaymentType> = {
    subscription: PaymentType.SUBSCRIPTION,
    assessment: PaymentType.ASSESSMENT,
    document_copy: PaymentType.DOCUMENT_COPY,
  };

  return map[type];
}

export function fromRpcPaymentType(type: PaymentType): TransactionType {
  switch (type) {
    case PaymentType.SUBSCRIPTION:
      return 'subscription';
    case PaymentType.DOCUMENT_COPY:
      return 'document_copy';
    case PaymentType.ASSESSMENT:
    case PaymentType.UNSPECIFIED:
    default:
      return 'assessment';
  }
}

export function normalizeOptionalString(value: string): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toPaymentPageMeta(response: GetPaymentHistoryResponse): TransactionPageMeta | null {
  return response.meta
    ? {
        totalItems: response.meta.totalItems,
        totalPages: response.meta.totalPages,
        currentPage: response.meta.currentPage,
        perPage: response.meta.perPage,
      }
    : null;
}

function normalizePaymentStatus(status: PaymentStatus): PaymentStatus {
  return status === PaymentStatus.UNSPECIFIED ? PaymentStatus.PENDING : status;
}

function normalizePaymentType(type: PaymentType): PaymentType {
  return type === PaymentType.UNSPECIFIED ? PaymentType.ASSESSMENT : type;
}

function fromRpcPaymentReceiptStatus(status: PaymentReceiptStatus): TransactionReceiptStatus {
  switch (status) {
    case PaymentReceiptStatus.PENDING:
      return 'pending';
    case PaymentReceiptStatus.AVAILABLE:
      return 'available';
    case PaymentReceiptStatus.FAILED:
      return 'failed';
    case PaymentReceiptStatus.UNSPECIFIED:
    default:
      return 'unspecified';
  }
}

function toUtcBoundary(value: string, edge: 'start' | 'end') {
  const suffix = edge === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
  return timestampFromDate(new Date(`${value}${suffix}`));
}
