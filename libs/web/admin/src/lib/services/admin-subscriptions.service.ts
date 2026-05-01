import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SubscriptionPlan } from '@notary-portal/api-contracts';

export type AdminSubscriptionRow = {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: 'Active' | 'Expired' | 'Cancelled';
};

@Injectable({ providedIn: 'root' })
export class AdminSubscriptionsService {
  private http = inject(HttpClient);
  private baseUrl = '/api/subscriptions';

  list(params?: { skip?: number; take?: number; plan?: SubscriptionPlan; status?: 'active' | 'expired' | 'cancelled' }): Observable<AdminSubscriptionRow[]> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.skip !== undefined) httpParams = httpParams.set('skip', params.skip);
      if (params.take !== undefined) httpParams = httpParams.set('take', params.take);
      if (params.plan) httpParams = httpParams.set('plan', params.plan);
      if (params.status) httpParams = httpParams.set('status', params.status);
    }
    return this.http.get<AdminSubscriptionRow[]>(this.baseUrl, { params: httpParams });
  }

  cancel(id: string): Observable<AdminSubscriptionRow> {
    return this.http.patch<AdminSubscriptionRow>(`${this.baseUrl}/${encodeURIComponent(id)}/cancel`, {});
  }
}

