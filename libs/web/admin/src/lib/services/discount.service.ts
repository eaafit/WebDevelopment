import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Discount } from '@internal/api/discount';

@Injectable({ providedIn: 'root' })
export class DiscountService {
  private http = inject(HttpClient);
  private apiUrl = '/api/discounts';

  getAll(params?: any): Observable<Discount[]> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach((key) => {
        const value = params[key];
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, value);
        }
      });
    }
    return this.http.get<Discount[]>(this.apiUrl, { params: httpParams });
  }

  getOne(id: number): Observable<Discount> {
    return this.http.get<Discount>(`${this.apiUrl}/${id}`);
  }

  create(data: any): Observable<Discount> {
    return this.http.post<Discount>(this.apiUrl, data);
  }

  update(id: number, data: any): Observable<Discount> {
    return this.http.put<Discount>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
