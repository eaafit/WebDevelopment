import {
  type TransactionHistoryQuery,
  type TransactionHistoryResponse,
} from '@notary-portal/api-contracts';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TransactionsApiService {
  private readonly http = inject(HttpClient);

  getTransactionHistory(query: TransactionHistoryQuery): Observable<TransactionHistoryResponse> {
    let params = new HttpParams();

    if (query.userId) {
      params = params.set('userId', query.userId);
    }

    if (query.page) {
      params = params.set('page', query.page);
    }

    if (query.limit) {
      params = params.set('limit', query.limit);
    }

    if (query.searchQuery) {
      params = params.set('searchQuery', query.searchQuery);
    }

    if (query.statuses?.length) {
      params = params.set('statuses', query.statuses.join(','));
    }

    if (query.types?.length) {
      params = params.set('types', query.types.join(','));
    }

    if (query.dateFrom) {
      params = params.set('dateFrom', query.dateFrom);
    }

    if (query.dateTo) {
      params = params.set('dateTo', query.dateTo);
    }

    return this.http.get<TransactionHistoryResponse>(buildApiUrl('transaction-history'), {
      params,
    });
  }
}

function buildApiUrl(path: string): string {
  if (typeof window === 'undefined') {
    return `http://localhost:3000/api/${path}`;
  }

  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocalhost && window.location.port !== '3000') {
    return `http://${window.location.hostname}:3000/api/${path}`;
  }

  return `/api/${path}`;
}
