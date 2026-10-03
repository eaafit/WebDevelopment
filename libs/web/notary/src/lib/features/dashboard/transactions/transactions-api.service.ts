import { createClient } from '@connectrpc/connect';
import { PaymentService } from '@notary-portal/api-contracts';
import {
  RPC_TRANSPORT,
  TokenStore,
  buildPaymentHistoryRequest,
  buildRpcBaseUrl,
  toRpcPaymentStatus,
  toTransactionHistoryPage,
} from '@notary-portal/ui';
import type {
  TransactionHistoryPage,
  TransactionItem,
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
      map((response) => toTransactionHistoryPage(response)),
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

}

// ─── Хелперы ─────────────────────────────────────────────────────────────────

function buildRequest(query: TransactionsHistoryQuery) {
  return buildPaymentHistoryRequest({
    page: query.page,
    limit: query.limit,
    searchQuery: query.searchQuery,
    statuses: query.status ? [toRpcPaymentStatus(query.status)] : [],
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });
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
