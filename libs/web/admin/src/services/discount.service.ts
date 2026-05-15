import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { buildRpcBaseUrl } from '@notary-portal/ui';

/** DTO скидки (REST `/api/discounts`). */
export interface Discount {
  id: number;
  name: string;
  percentage: number;
  description?: string;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountQueryParams {
  page?: number | string;
  limit?: number | string;
  filterName?: string;
  filterStatus?: string;
  filterDateFrom?: string;
  filterDateTo?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
  };
}

export interface DiscountCreatePayload {
  name: string;
  percentage: number;
  description?: string | null;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
}

export type DiscountUpdatePayload = Partial<DiscountCreatePayload>;

@Injectable({ providedIn: 'root' })
export class DiscountService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${buildRpcBaseUrl()}/api/discounts`;

  getAll(params?: DiscountQueryParams): Observable<Discount[]> {
    let httpParams = new HttpParams();
    if (params) {
      (Object.keys(params) as (keyof DiscountQueryParams)[]).forEach((key) => {
        const v = params[key];
        if (v !== undefined && v !== null && v !== '') {
          httpParams = httpParams.set(key, String(v));
        }
      });
    }
    return this.http
      .get<PaginatedResponse<Discount>>(this.apiUrl, { params: httpParams })
      .pipe(map((res) => res.items));
  }

  getOne(id: number): Observable<Discount> {
    return this.http.get<Discount>(`${this.apiUrl}/${id}`);
  }

  create(data: DiscountCreatePayload): Observable<Discount> {
    return this.http.post<Discount>(this.apiUrl, data);
  }

  update(id: number, data: DiscountUpdatePayload): Observable<Discount> {
    return this.http.put<Discount>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
