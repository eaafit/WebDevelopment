import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AssessmentOrder } from './history/models';

export interface ListOrdersResponse {
  orders: AssessmentOrder[];
  totalCount: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class OrderApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:3000';

  listOrders(params: {
    userId: string;
    role: string;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    pageSize: number;
  }): Observable<ListOrdersResponse> {
    const cleanParams: any = { ...params };
    if (cleanParams.status === 'all') delete cleanParams.status;
    return this.http.get<ListOrdersResponse>(this.baseUrl, { params: cleanParams });
  }

  getOrder(id: string): Observable<AssessmentOrder> {
    return this.http.get<AssessmentOrder>(`${this.baseUrl}/${id}`);
  }
}