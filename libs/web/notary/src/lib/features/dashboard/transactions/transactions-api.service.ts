import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import {
  PaymentService,
  PaymentStatus,
  PaymentType,
  type GetPaymentHistoryResponse,
  type Payment,
} from '@notary-portal/api-contracts';
import type { TransactionHistoryPage, TransactionItem, TransactionStatus } from '@notary-portal/ui';
import { Injectable } from '@angular/core';
import { from, map, type Observable } from 'rxjs';

export interface TransactionsHistoryQuery {
  page: number;
  limit: number;
  searchQuery?: string;
  status?: TransactionStatus;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable({ providedIn: 'root' })
export class TransactionsApiService {
  private readonly client = createClient(
    PaymentService,
    createConnectTransport({
      baseUrl: buildRpcBaseUrl(),
    }),
  );

  getTransactionHistory(query: TransactionsHistoryQuery): Observable<TransactionHistoryPage> {
    return from(this.client.getPaymentHistory(buildRequest(query))).pipe(
      map((response) => this.toTransactionHistoryPage(response)),
    );
  }

  private toTransactionHistoryPage(response: GetPaymentHistoryResponse): TransactionHistoryPage {
    return {
      transactions: response.payments.map((payment) => this.toTransactionItem(payment)),
      meta: response.meta
        ? {
            totalItems: response.meta.totalItems,
            totalPages: response.meta.totalPages,
            currentPage: response.meta.currentPage,
            perPage: response.meta.perPage,
          }
        : null,
    };
  }

  private toTransactionItem(payment: Payment): TransactionItem {
    return {
      id: payment.id,
      userId: payment.userId,
      type: fromPaymentType(payment.type),
      status: fromPaymentStatus(payment.status),
      paymentDate: payment.paymentDate ? timestampDate(payment.paymentDate).toISOString() : '',
      transactionId: normalizeOptionalString(payment.transactionId),
      amount: payment.amount?.amount ?? '0',
      currency: payment.amount?.currency ?? 'RUB',
      description: payment.description,
      paymentMethod: normalizeOptionalString(payment.paymentMethod),
      attachmentFileName: normalizeOptionalString(payment.attachmentFileName),
      attachmentFileUrl: normalizeOptionalString(payment.attachmentFileUrl),
      subscriptionId: normalizeOptionalString(payment.subscriptionId),
      assessmentId: normalizeOptionalString(payment.assessmentId),
    };
  }
}

function buildRequest(query: TransactionsHistoryQuery) {
  const paymentDateRange =
    query.dateFrom || query.dateTo
      ? {
          startDate: query.dateFrom ? toUtcBoundary(query.dateFrom, 'start') : undefined,
          endDate: query.dateTo ? toUtcBoundary(query.dateTo, 'end') : undefined,
        }
      : undefined;

  return {
    pagination: {
      page: query.page,
      limit: query.limit,
    },
    filters: {
      searchQuery: query.searchQuery ?? '',
      statuses: query.status ? [toPaymentStatus(query.status)] : [],
      paymentDateRange,
    },
  };
}

function buildRpcBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocalhost && window.location.port !== '3000') {
    return `http://${window.location.hostname}:3000`;
  }

  return window.location.origin;
}

function toPaymentStatus(status: TransactionStatus): PaymentStatus {
  switch (status) {
    case 'pending':
      return PaymentStatus.PENDING;
    case 'completed':
      return PaymentStatus.COMPLETED;
    case 'failed':
      return PaymentStatus.FAILED;
    case 'refunded':
      return PaymentStatus.REFUNDED;
  }

  throw new Error(`Unsupported transaction status: ${status}`);
}

function fromPaymentStatus(status: PaymentStatus): TransactionStatus {
  switch (status) {
    case PaymentStatus.PENDING:
      return 'pending';
    case PaymentStatus.COMPLETED:
      return 'completed';
    case PaymentStatus.FAILED:
      return 'failed';
    case PaymentStatus.REFUNDED:
      return 'refunded';
    case PaymentStatus.UNSPECIFIED:
      throw new Error('Payment status is unspecified');
  }

  throw new Error(`Unsupported payment status: ${status}`);
}

function fromPaymentType(type: PaymentType): TransactionItem['type'] {
  switch (type) {
    case PaymentType.SUBSCRIPTION:
      return 'subscription';
    case PaymentType.ASSESSMENT:
      return 'assessment';
    case PaymentType.DOCUMENT_COPY:
      return 'document_copy';
    case PaymentType.UNSPECIFIED:
      throw new Error('Payment type is unspecified');
  }

  throw new Error(`Unsupported payment type: ${type}`);
}

function normalizeOptionalString(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toUtcBoundary(value: string, edge: 'start' | 'end') {
  const suffix = edge === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
  return timestampFromDate(new Date(`${value}${suffix}`));
}
