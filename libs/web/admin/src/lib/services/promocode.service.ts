import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Promocode } from '@internal/api/promocode';

@Injectable({ providedIn: 'root' })
export class PromocodeService {
  private http = inject(HttpClient);
  private apiUrl = '/api/promocodes';

  getAll(params?: any): Observable<Promocode[]> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== '')
          httpParams = httpParams.set(key, params[key]);
      });
    }
    return this.http.get<Promocode[]>(this.apiUrl, { params: httpParams });
  }

  getOne(id: number): Observable<Promocode> {
    return this.http.get<Promocode>(`${this.apiUrl}/${id}`);
  }

  create(data: any): Observable<Promocode> {
    return this.http.post<Promocode>(this.apiUrl, data);
  }

  update(id: number, data: any): Observable<Promocode> {
    return this.http.put<Promocode>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
