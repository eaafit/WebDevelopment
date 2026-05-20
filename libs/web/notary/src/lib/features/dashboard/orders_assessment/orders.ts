import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AssessmentOrder, AssessmentOrderStatus, OrdersApiService } from './orders-api.service';

@Component({
  selector: 'lib-notary-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotaryOrders {
  private readonly ordersApi = inject(OrdersApiService);

  readonly orders = signal<AssessmentOrder[]>(this.ordersApi.list());

  readonly statusOrder: AssessmentOrderStatus[] = [
    'Created',
    'Accepted',
    'InReview',
    'Completed',
    'Rejected',
  ];

  reload(): void {
    this.orders.set(this.ordersApi.list());
  }

  deleteOrder(id: string): void {
    this.ordersApi.delete(id);
    this.reload();
  }

  restoreDemo(): void {
    this.ordersApi.restoreDemo();
    this.reload();
  }

  statusLabel(status: AssessmentOrderStatus): string {
    return this.ordersApi.getStatusLabel(status);
  }

  statusClass(status: AssessmentOrderStatus): string {
    return `order-status order-status--${status.toLowerCase()}`;
  }

  isStageDone(order: AssessmentOrder, status: AssessmentOrderStatus): boolean {
    return this.statusOrder.indexOf(status) <= this.statusOrder.indexOf(order.status);
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
