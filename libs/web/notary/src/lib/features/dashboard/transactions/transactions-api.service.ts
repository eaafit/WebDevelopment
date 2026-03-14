import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  PaymentService,
  PaymentStatus,
  PaymentType,
  type GetPaymentHistoryResponse,
  type Payment,
} from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import type { TransactionHistoryPage, TransactionItem, TransactionStatus } from '@notary-portal/ui';
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

  getTransactionHistory(query: TransactionsHistoryQuery): Observable<TransactionHistoryPage> {
    return from(this.client['getPaymentHistory'](buildRequest(query))).pipe(
      map((response) => this.toTransactionHistoryPage(response)),
    );
  }

  private toTransactionHistoryPage(response: GetPaymentHistoryResponse): TransactionHistoryPage {
    return {
      transactions: response.payments.map((p: Payment) => this.toTransactionItem(p)),
      meta: response.meta
        ? {
            totalItems:  response.meta.totalItems,
            totalPages:  response.meta.totalPages,
            currentPage: response.meta.currentPage,
            perPage:     response.meta.perPage,
          }
        : null,
    };
  }

  private toTransactionItem(payment: Payment): TransactionItem {
    return {
      id:                 payment.id,
      userId:             payment.userId,
      type:               fromPaymentType(payment.type),
      status:             fromPaymentStatus(payment.status),
      paymentDate:        payment.paymentDate ? timestampDate(payment.paymentDate).toISOString() : '',
      transactionId:      nullIfEmpty(payment.transactionId),
      amount:             payment.amount?.amount ?? '0',
      currency:           payment.amount?.currency ?? 'RUB',
      description:        payment.description,
      paymentMethod:      nullIfEmpty(payment.paymentMethod),
      attachmentFileName: nullIfEmpty(payment.attachmentFileName),
      attachmentFileUrl:  nullIfEmpty(payment.attachmentFileUrl),
      subscriptionId:     nullIfEmpty(payment.subscriptionId),
      assessmentId:       nullIfEmpty(payment.assessmentId),
    };
  }
}

// в”Ђв”Ђв”Ђ РҐРµР»РїРµСЂС‹ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

function buildRequest(query: TransactionsHistoryQuery) {
  const paymentDateRange =
    query.dateFrom || query.dateTo
      ? {
          startDate: query.dateFrom ? toUtcBoundary(query.dateFrom, 'start') : undefined,
          endDate:   query.dateTo   ? toUtcBoundary(query.dateTo,   'end')   : undefined,
        }
      : undefined;

  return {
    pagination: { page: query.page, limit: query.limit },
    filters: {
      searchQuery:    query.searchQuery ?? '',
      statuses:       query.status ? [toPaymentStatus(query.status)] : [],
      paymentDateRange,
    },
  };
}

function toPaymentStatus(s: TransactionStatus): PaymentStatus {
  const map: Record<TransactionStatus, PaymentStatus> = {
    pending:   PaymentStatus.PENDING,
    completed: PaymentStatus.COMPLETED,
    failed:    PaymentStatus.FAILED,
    refunded:  PaymentStatus.REFUNDED,
  };
  return map[s];
}

function fromPaymentStatus(s: PaymentStatus): TransactionStatus {
  switch (s) {
    case PaymentStatus.PENDING:   return 'pending';
    case PaymentStatus.COMPLETED: return 'completed';
    case PaymentStatus.FAILED:    return 'failed';
    case PaymentStatus.REFUNDED:  return 'refunded';
    default: throw new Error(`Unsupported payment status: ${s}`);
  }
}

function fromPaymentType(t: PaymentType): TransactionItem['type'] {
  switch (t) {
    case PaymentType.SUBSCRIPTION:  return 'subscription';
    case PaymentType.ASSESSMENT:    return 'assessment';
    case PaymentType.DOCUMENT_COPY: return 'document_copy';
    default: throw new Error(`Unsupported payment type: ${t}`);
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

