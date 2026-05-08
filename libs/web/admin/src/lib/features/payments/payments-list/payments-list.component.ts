import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PaymentStatus, PaymentType } from '@notary-portal/api-contracts';
import { AdminPaymentsApiService, AdminPaymentItem, PaymentQuery } from '../../../api/admin-payments-api.service';
import { PaymentDetailPanelComponent } from '../payment-detail-panel/payment-detail-panel.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'lib-admin-payments-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PaymentDetailPanelComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Платежи</h1>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="exportCsv()">Экспорт CSV</button>
          <button class="btn btn-primary" (click)="addPayment()">Добавить платёж</button>
        </div>
      </div>

      <div class="filters">
        <div class="filter-group">
          <label>Статус</label>
          <select multiple [(ngModel)]="filters.statuses" (change)="applyFilters()">
            <option *ngFor="let s of statusOptions" [ngValue]="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Тип</label>
          <select [(ngModel)]="filters.type" (change)="applyFilters()">
            <option [ngValue]="null">Все типы</option>
            <option *ngFor="let t of typeOptions" [ngValue]="t.value">{{ t.label }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Дата от</label>
          <input type="date" [(ngModel)]="filters.dateFrom" (change)="applyFilters()">
        </div>
        <div class="filter-group">
          <label>Дата до</label>
          <input type="date" [(ngModel)]="filters.dateTo" (change)="applyFilters()">
        </div>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>ID транзакции</th>
              <th>Пользователь</th>
              <th>Тип</th>
              <th>Сумма</th>
              <th>Статус</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of payments" (click)="openDetail(p)" class="clickable-row">
              <td>{{ p.transactionId || '—' }}</td>
              <td>{{ p.userId }}</td>
              <td>{{ getTypeLabel(p.type) }}</td>
              <td>{{ formatAmount(p.amount) }}</td>
              <td>
                <span class="status-badge" [ngClass]="getStatusClass(p.status)">
                  {{ getStatusLabel(p.status) }}
                </span>
              </td>
              <td>{{ formatDate(p.paymentDate) }}</td>
            </tr>
            <tr *ngIf="payments.length === 0 && !loading">
              <td colspan="6" class="empty-state">Платежи не найдены</td>
            </tr>
            <tr *ngIf="loading">
              <td colspan="6" class="empty-state">Загрузка...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination" *ngIf="totalPages > 1">
        <button [disabled]="currentPage === 1" (click)="changePage(currentPage - 1)">Назад</button>
        <span>Страница {{ currentPage }} из {{ totalPages }}</span>
        <button [disabled]="currentPage === totalPages" (click)="changePage(currentPage + 1)">Вперед</button>
      </div>
    </div>

    <lib-payment-detail-panel
      *ngIf="selectedPayment"
      [payment]="selectedPayment"
      (close)="selectedPayment = null"
      (deleted)="onPaymentDeleted($event)"
    ></lib-payment-detail-panel>
  `,
  styles: [
    `
      .page-container { padding: 24px; max-width: 1200px; margin: 0 auto; }
      .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
      .page-header h1 { margin: 0; font-size: 1.5rem; }
      .header-actions { display: flex; gap: 12px; }
      .btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-weight: 500; }
      .btn-primary { background: #3b82f6; color: white; }
      .btn-secondary { background: #f1f5f9; color: #334155; }
      .filters { display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-end; }
      .filter-group { display: flex; flex-direction: column; gap: 4px; }
      .filter-group label { font-size: 0.875rem; color: #64748b; }
      .filter-group select, .filter-group input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; }
      .table-container { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #f1f5f9; }
      .table th { background: #f8fafc; font-weight: 600; color: #475569; }
      .clickable-row { cursor: pointer; transition: background 0.2s; }
      .clickable-row:hover { background: #f8fafc; }
      .empty-state { text-align: center; color: #64748b; padding: 32px !important; }
      .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.875rem; font-weight: 500; }
      .status-pending { background: #fef08a; color: #854d0e; }
      .status-completed { background: #bbf7d0; color: #166534; }
      .status-failed { background: #fecaca; color: #991b1b; }
      .status-refunded { background: #e2e8f0; color: #334155; }
      .pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 24px; }
      .pagination button { padding: 8px 16px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer; }
      .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
    `
  ]
})
export class PaymentsListComponent implements OnInit, OnDestroy {
  payments: AdminPaymentItem[] = [];
  loading = false;
  currentPage = 1;
  totalPages = 1;
  limit = 10;

  selectedPayment: AdminPaymentItem | null = null;

  filters = {
    statuses: [] as PaymentStatus[],
    type: null as PaymentType | null,
    dateFrom: '',
    dateTo: ''
  };

  statusOptions = [
    { value: PaymentStatus.PENDING, label: 'Ожидает' },
    { value: PaymentStatus.COMPLETED, label: 'Завершён' },
    { value: PaymentStatus.FAILED, label: 'Ошибка' },
    { value: PaymentStatus.REFUNDED, label: 'Возврат' }
  ];

  typeOptions = [
    { value: PaymentType.SUBSCRIPTION, label: 'Подписка' },
    { value: PaymentType.ASSESSMENT, label: 'Оценка' },
    { value: PaymentType.DOCUMENT_COPY, label: 'Копия документа' }
  ];

  private readonly api = inject(AdminPaymentsApiService);
  private readonly router = inject(Router);
  private sub?: Subscription;

  ngOnInit(): void {
    this.loadPayments();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  loadPayments(): void {
    this.loading = true;
    const query: PaymentQuery = {
      page: this.currentPage,
      limit: this.limit,
      statuses: this.filters.statuses,
      types: this.filters.type !== null ? [this.filters.type] : [],
      dateFrom: this.filters.dateFrom || undefined,
      dateTo: this.filters.dateTo || undefined
    };

    this.sub?.unsubscribe();
    this.sub = this.api.listPayments(query).subscribe({
      next: (res) => {
        this.payments = res.payments;
        this.totalPages = res.meta?.totalPages || 1;
        this.loading = false;
      },
      error: (err) => {
        console.error('Не удалось загрузить платежи', err);
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadPayments();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadPayments();
    }
  }

  openDetail(payment: AdminPaymentItem): void {
    this.selectedPayment = payment;
  }

  addPayment(): void {
    this.router.navigate(['/admin', 'payments', 'new']);
  }

  formatAmount(amount: number): string {
    return amount.toLocaleString('ru-RU') + ' ₽';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${mins}`;
  }

  getStatusLabel(status: PaymentStatus): string {
    return this.statusOptions.find(o => o.value === status)?.label || 'Неизвестно';
  }

  getStatusClass(status: PaymentStatus): string {
    const map: Record<PaymentStatus, string> = {
      [PaymentStatus.UNSPECIFIED]: '',
      [PaymentStatus.PENDING]: 'status-pending',
      [PaymentStatus.COMPLETED]: 'status-completed',
      [PaymentStatus.FAILED]: 'status-failed',
      [PaymentStatus.REFUNDED]: 'status-refunded'
    };
    return map[status] || '';
  }

  getTypeLabel(type: PaymentType): string {
    return this.typeOptions.find(o => o.value === type)?.label || 'Неизвестно';
  }

  exportCsv(): void {
    if (!this.payments.length) return;

    const rows = this.payments.map(p => [
      p.transactionId || '',
      p.userId || '',
      this.getTypeLabel(p.type),
      p.amount.toString(),
      p.currency,
      this.getStatusLabel(p.status),
      this.formatDate(p.paymentDate)
    ]);

    const header = ['ID транзакции', 'ID пользователя', 'Тип', 'Сумма', 'Валюта', 'Статус', 'Дата'];
    const csvContent = [header, ...rows]
      .map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payments_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  onPaymentDeleted(id: string): void {
    this.selectedPayment = null;
    this.loadPayments();
  }
}

