import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { buildRpcBaseUrl } from '@notary-portal/ui';

/** Промокод из таблицы `promocodes` (REST `/api/promocodes`). */
export interface PromocodeDto {
  id: number;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  description?: string | null;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  maxUses: number;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromocodeQueryParams {
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

export interface PromocodeCreatePayload {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  description?: string | null;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  maxUses: number;
}

export type PromocodeUpdatePayload = Partial<PromocodeCreatePayload>;

@Injectable({ providedIn: 'root' })
export class PromocodeService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${buildRpcBaseUrl()}/api/promocodes`;

  getAll(params?: PromocodeQueryParams): Observable<PromocodeDto[]> {
    let httpParams = new HttpParams();
    if (params) {
      (Object.keys(params) as (keyof PromocodeQueryParams)[]).forEach((key) => {
        const v = params[key];
        if (v !== undefined && v !== null && v !== '') {
          httpParams = httpParams.set(key, String(v));
        }
      });
    }
    return this.http
      .get<PaginatedResponse<PromocodeDto>>(this.apiUrl, { params: httpParams })
      .pipe(map((res) => res.items));
  }

  create(data: PromocodeCreatePayload): Observable<PromocodeDto> {
    return this.http.post<PromocodeDto>(this.apiUrl, data);
  }

  update(id: number, data: PromocodeUpdatePayload): Observable<PromocodeDto> {
    return this.http.put<PromocodeDto>(`${this.apiUrl}/${id}`, data);
  }
}
