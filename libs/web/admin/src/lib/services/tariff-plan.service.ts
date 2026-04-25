import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TariffPlan } from '@internal/api/tariff-plan';

@Injectable({ providedIn: 'root' })
export class TariffPlanService {
  private http = inject(HttpClient);
  private apiUrl = '/api/tariff-plans';

  getAll(params?: any): Observable<TariffPlan[]> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== '')
          httpParams = httpParams.set(key, params[key]);
      });
    }
    return this.http.get<TariffPlan[]>(this.apiUrl, { params: httpParams });
  }

  getOne(id: number): Observable<TariffPlan> {
    return this.http.get<TariffPlan>(`${this.apiUrl}/${id}`);
  }

  create(data: any): Observable<TariffPlan> {
    return this.http.post<TariffPlan>(this.apiUrl, data);
  }

  update(id: number, data: any): Observable<TariffPlan> {
    return this.http.put<TariffPlan>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
