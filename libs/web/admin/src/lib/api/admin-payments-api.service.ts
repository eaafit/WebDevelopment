import { Injectable, inject } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { createClient } from '@connectrpc/connect';
import {
  PaymentService,
  PaymentStatus,
  PaymentType,
  GetPaymentHistoryResponse,
  Payment,
} from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';

export interface PaymentQuery {
  page: number;
  limit: number;
  statuses: PaymentStatus[];
  types: PaymentType[];
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminPaymentItem {
  id: string;
  transactionId?: string;
  userId: string;
  payer: string;
  type: PaymentType;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentDate: string;
  paymentMethod?: string;
  subscriptionId?: string;
  assessmentId?: string;
  attachmentFileName?: string;
  attachmentFileUrl?: string;
}

export interface PaymentHistoryPage {
  payments: AdminPaymentItem[];
  meta: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class AdminPaymentsApiService {
  private readonly client = createClient(PaymentService, inject(RPC_TRANSPORT));

  listPayments(query: PaymentQuery): Observable<PaymentHistoryPage> {
    const paymentDateRange =
      query.dateFrom || query.dateTo
        ? {
            startDate: query.dateFrom ? toUtcBoundary(query.dateFrom, 'start') : undefined,
            endDate: query.dateTo ? toUtcBoundary(query.dateTo, 'end') : undefined,
          }
        : undefined;

    const request = {
      pagination: { page: query.page, limit: query.limit },
      filters: {
        statuses: query.statuses,
        types: query.types,
        paymentDateRange,
      },
    };

    return from(this.client.getPaymentHistory(request)).pipe(
      map((response) => this.toPaymentHistoryPage(response))
    );
  }

  private toPaymentHistoryPage(response: GetPaymentHistoryResponse): PaymentHistoryPage {
    return {
      payments: response.payments.map((p) => this.toAdminPaymentItem(p)),
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

  private toAdminPaymentItem(payment: Payment): AdminPaymentItem {
    return {
      id: payment.id,
      transactionId: payment.transactionId || undefined,
      userId: payment.userId,
      payer: payment.userId,
      type: payment.type,
      amount: payment.amount ? Number(payment.amount.amount) : 0,
      currency: payment.amount?.currency ?? 'RUB',
      status: payment.status,
      paymentDate: payment.paymentDate ? timestampDate(payment.paymentDate).toISOString() : '',
      paymentMethod: payment.paymentMethod || undefined,
      subscriptionId: payment.subscriptionId || undefined,
      assessmentId: payment.assessmentId || undefined,
      attachmentFileName: payment.attachmentFileName || undefined,
      attachmentFileUrl: payment.attachmentFileUrl || undefined,
    };
  }
}

function toUtcBoundary(value: string, edge: 'start' | 'end') {
  const suffix = edge === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
  return timestampFromDate(new Date(`${value}${suffix}`));
}
