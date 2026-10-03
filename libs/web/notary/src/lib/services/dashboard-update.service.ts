import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface DashboardMetrics {
  total: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardUpdateService {
  private metricsSubject = new Subject<DashboardMetrics>();
  metrics$ = this.metricsSubject.asObservable();

  updateMetrics(metrics: DashboardMetrics): void {
    this.metricsSubject.next(metrics);
  }
}