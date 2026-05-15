import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { buildRpcBaseUrl } from '@notary-portal/ui';

/** DTO тарифного плана (ответ REST `/api/tariff-plans`). */
export interface TariffPlan {
  id: number;
  name: string;
  price: number;
  description?: string;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  createdAt: string;
  updatedAt: string;
}

export interface TariffPlanQueryParams {
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

export interface TariffPlanCreatePayload {
  name: string;
  price: number;
  description?: string;
  isActive: boolean;
  validFrom: string;
  validTo: string;
}

export type TariffPlanUpdatePayload = Partial<TariffPlanCreatePayload>;

@Injectable({ providedIn: 'root' })
export class TariffPlanService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${buildRpcBaseUrl()}/api/tariff-plans`;

  getAll(params?: TariffPlanQueryParams): Observable<TariffPlan[]> {
    let httpParams = new HttpParams();
    if (params) {
      (Object.keys(params) as (keyof TariffPlanQueryParams)[]).forEach((key) => {
        const v = params[key];
        if (v !== undefined && v !== '') {
          httpParams = httpParams.set(key, String(v));
        }
      });
    }
    return this.http
      .get<PaginatedResponse<TariffPlan>>(this.apiUrl, { params: httpParams })
      .pipe(map((res) => res.items));
  }

  getOne(id: number): Observable<TariffPlan> {
    return this.http.get<TariffPlan>(`${this.apiUrl}/${id}`);
  }

  create(data: TariffPlanCreatePayload): Observable<TariffPlan> {
    return this.http.post<TariffPlan>(this.apiUrl, data);
  }

  update(id: number, data: TariffPlanUpdatePayload): Observable<TariffPlan> {
    return this.http.put<TariffPlan>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
