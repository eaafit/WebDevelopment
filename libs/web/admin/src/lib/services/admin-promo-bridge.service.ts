import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { createClient } from '@connectrpc/connect';
import { PaymentService } from '@notary-portal/api-contracts';
import { buildRpcBaseUrl, RPC_TRANSPORT } from '@notary-portal/ui';
import { map, Observable } from 'rxjs';

export type AdminPromoRow = {
  id: string;
  code: string;
  discountPercent: number;
  usageLimit: number;
  usedCount: number;
  expiresAt: string;
  status: 'Active' | 'Expired' | 'Inactive';
};

@Injectable({ providedIn: 'root' })
export class AdminPromoBridgeService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = `${buildRpcBaseUrl()}/api`;

  // Infrastructure for future contract call.
  private readonly paymentClient = createClient(PaymentService, inject(RPC_TRANSPORT));

  list(filter?: string): Observable<AdminPromoRow[]> {
    let params = new HttpParams();
    if (filter?.trim()) {
      params = params.set('filter', filter.trim());
    }
    // TODO: Service not exported - bridge to Backend
    return this.http.get<AdminPromoRow[]>(`${this.apiBaseUrl}/promos`, { params });
  }

  create(payload: {
    code: string;
    discountPercent: number;
    usageLimit: number;
    expiresAt: string;
  }): Observable<AdminPromoRow> {
    // TODO: Service not exported - bridge to Backend
    return this.http
      .post<{
        id: number;
        code: string;
        discountValue: number;
        maxUses: number;
        usedCount: number;
        validTo: string;
      }>(`${this.apiBaseUrl}/promocodes`, {
        code: payload.code,
        discountType: 'percentage',
        discountValue: payload.discountPercent,
        description: `Promo ${payload.code}`,
        isActive: true,
        validFrom: new Date().toISOString(),
        validTo: payload.expiresAt,
        maxUses: payload.usageLimit,
      })
      .pipe(
        map((row) => ({
          id: String(row.id),
          code: row.code,
          discountPercent: Number(row.discountValue),
          usageLimit: Number(row.maxUses),
          usedCount: Number(row.usedCount),
          expiresAt: row.validTo,
          status: 'Active' as const,
        })),
      );
  }

  deactivate(id: string): Observable<{ ok: true }> {
    // TODO: Service not exported - bridge to Backend
    return this.http.patch<{ ok: true }>(
      `${this.apiBaseUrl}/promos/${encodeURIComponent(id)}/deactivate`,
      {},
    );
  }
}

