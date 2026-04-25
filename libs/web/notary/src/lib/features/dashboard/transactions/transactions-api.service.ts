import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  PaymentService,
  PaymentReceiptStatus,
  PaymentStatus,
  PaymentType,
  type GetPaymentHistoryResponse,
  type Payment,
} from '@notary-portal/api-contracts';
import { RPC_TRANSPORT, TokenStore, buildRpcBaseUrl } from '@notary-portal/ui';
import type {
  TransactionHistoryPage,
  TransactionItem,
  TransactionReceiptStatus,
  TransactionStatus,
} from '@notary-portal/ui';
import { Injectable, inject } from '@angular/core';
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
  private readonly client = createClient(PaymentService, inject(RPC_TRANSPORT));
  private readonly tokenStore = inject(TokenStore);

  getTransactionHistory(query: TransactionsHistoryQuery): Observable<TransactionHistoryPage> {
    return from(this.client.getPaymentHistory(buildRequest(query))).pipe(
      map((response) => this.toTransactionHistoryPage(response)),
    );
  }

  async openReceipt(transaction: Pick<TransactionItem, 'id'>): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('Receipt downloads are only available in the browser');
    }

    const token = this.tokenStore.getAccessToken();
    if (!token) {
      throw new Error('Session expired');
    }

    const response = await fetch(`${buildRpcBaseUrl()}/api/payments/${transaction.id}/receipt`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(await extractReceiptError(response));
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const openedWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer');

    if (!openedWindow) {
      window.location.assign(objectUrl);
    }

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  private toTransactionHistoryPage(response: GetPaymentHistoryResponse): TransactionHistoryPage {
    return {
      transactions: response.payments.map((p) => this.toTransactionItem(p)),
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
      transactionId: nullIfEmpty(payment.transactionId),
      amount: payment.amount?.amount ?? '0',
      currency: payment.amount?.currency ?? 'RUB',
      description: payment.description,
      paymentMethod: nullIfEmpty(payment.paymentMethod),
      hasReceipt: payment.hasReceipt,
      receiptStatus: fromPaymentReceiptStatus(payment.receiptStatus),
      attachmentFileName: nullIfEmpty(payment.attachmentFileName),
      attachmentFileUrl: nullIfEmpty(payment.attachmentFileUrl),
      subscriptionId: nullIfEmpty(payment.subscriptionId),
      assessmentId: nullIfEmpty(payment.assessmentId),
    };
  }
}

// ─── Хелперы ─────────────────────────────────────────────────────────────────

function buildRequest(query: TransactionsHistoryQuery) {
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
      searchQuery: query.searchQuery ?? '',
      statuses: query.status ? [toPaymentStatus(query.status)] : [],
      paymentDateRange,
    },
  };
}

function toPaymentStatus(s: TransactionStatus): PaymentStatus {
  const map: Record<TransactionStatus, PaymentStatus> = {
    pending: PaymentStatus.PENDING,
    completed: PaymentStatus.COMPLETED,
    failed: PaymentStatus.FAILED,
    refunded: PaymentStatus.REFUNDED,
  };
  return map[s];
}

function fromPaymentStatus(s: PaymentStatus): TransactionStatus {
  switch (s) {
    case PaymentStatus.PENDING:
      return 'pending';
    case PaymentStatus.COMPLETED:
      return 'completed';
    case PaymentStatus.FAILED:
      return 'failed';
    case PaymentStatus.REFUNDED:
      return 'refunded';
    default:
      throw new Error(`Unsupported payment status: ${s}`);
  }
}

function fromPaymentType(t: PaymentType): TransactionItem['type'] {
  switch (t) {
    case PaymentType.SUBSCRIPTION:
      return 'subscription';
    case PaymentType.ASSESSMENT:
      return 'assessment';
    case PaymentType.DOCUMENT_COPY:
      return 'document_copy';
    default:
      throw new Error(`Unsupported payment type: ${t}`);
  }
}

function fromPaymentReceiptStatus(status: PaymentReceiptStatus): TransactionReceiptStatus {
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

function nullIfEmpty(value: string): string | null {
  const s = value?.trim();
  return s ? s : null;
}

function toUtcBoundary(value: string, edge: 'start' | 'end') {
  const suffix = edge === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
  return timestampFromDate(new Date(`${value}${suffix}`));
}

async function extractReceiptError(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await response.json()) as { message?: unknown; error?: unknown };
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message.trim();
    }
    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error.trim();
    }
  }

  const text = (await response.text()).trim();
  if (text) {
    return text;
  }

  if (response.status === 401) {
    return 'Сессия истекла или недействительна. Войдите снова.';
  }

  if (response.status === 404) {
    return 'Чек не найден в хранилище.';
  }

  if (response.status === 409) {
    return 'Чек ещё формируется. Попробуйте открыть его позже.';
  }

  return `Не удалось открыть чек: HTTP ${response.status}`;
}
