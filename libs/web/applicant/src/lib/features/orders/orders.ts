import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApplicantOrdersApiService, ApplicantOrderView } from './orders-api.service';
import { EstimationFormSessionService } from '../estimation-form/estimation-form-session.service';

@Component({
  selector: 'lib-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class Orders implements OnInit {
  private readonly ordersApi = inject(ApplicantOrdersApiService);
  private readonly sessionService = inject(EstimationFormSessionService);
  private readonly router = inject(Router);

  orders = signal<ApplicantOrderView[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);

  statusFilter = signal<string>('all');
  searchQuery = signal<string>('');

  statuses = [
    { value: 'all', label: 'Все' },
    { value: 'new', label: 'Новая' },
    { value: 'progress', label: 'В работе' },
    { value: 'completed', label: 'Завершена' },
    { value: 'rejected', label: 'Отклонена' },
  ];

  async ngOnInit(): Promise<void> {
    await this.loadOrders();
  }

  get filteredOrders(): ApplicantOrderView[] {
    let result = this.orders();

    if (this.statusFilter() !== 'all') {
      result = result.filter((order) => order.status === this.statusFilter());
    }

    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      result = result.filter(
        (order) =>
          order.address.toLowerCase().includes(query) ||
          order.propertyType.toLowerCase().includes(query) ||
          order.id.toLowerCase().includes(query),
      );
    }

    return [...result].sort((left, right) => {
      const leftDate = parseRuDate(left.createdAt);
      const rightDate = parseRuDate(right.createdAt);
      return rightDate.getTime() - leftDate.getTime();
    });
  }

  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      new: 'status-new',
      progress: 'status-progress',
      completed: 'status-success',
      rejected: 'status-rejected',
    };
    return classes[status] || 'status-new';
  }

  getStatusText(status: string): string {
    const texts: Record<string, string> = {
      new: 'Новая',
      progress: 'В работе',
      completed: 'Завершена',
      rejected: 'Отклонена',
    };
    return texts[status] || status;
  }

  canEdit(status: string): boolean {
    return status === 'new';
  }

  canDelete(status: string): boolean {
    return status === 'new';
  }

  async deleteOrder(id: string): Promise<void> {
    const confirmed = confirm('Вы уверены, что хотите удалить этот заказ?');
    if (!confirmed) {
      return;
    }

    try {
      await this.ordersApi.deleteOrder(id);
      await this.loadOrders();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось удалить заказ.');
    }
  }

  viewOrder(id: string): void {
    void this.router.navigate(['/applicant/assessment/status'], {
      queryParams: { assessmentId: id },
    });
  }

  editOrder(id: string): void {
    void this.router.navigate(['/applicant/assessment'], {
      queryParams: { assessmentId: id },
    });
  }

  createOrder(): void {
    void this.router.navigate(['/applicant/orders/new']);
  }

  private async loadOrders(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    try {
      const userId = await this.sessionService.ensureUserId();
      const items = await this.ordersApi.listUserOrders(userId);
      this.orders.set(items);
    } catch (error) {
      this.loadError.set(
        error instanceof Error ? error.message : 'Не удалось загрузить список заявок.',
      );
      this.orders.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}

function parseRuDate(value: string): Date {
  const [day, month, year] = value.split('.').map((part) => Number(part));
  if (!day || !month || !year) {
    return new Date(0);
  }

  return new Date(year, month - 1, day);
}
