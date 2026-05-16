import { Component, HostListener, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PaymentStatus, PaymentType } from '@notary-portal/api-contracts';
import { AdminPaymentsApiService, AdminPaymentItem, PaymentQuery } from '../../../api/admin-payments-api.service';
import { PaymentDetailPanelComponent } from '../payment-detail-panel/payment-detail-panel.component';
import { PaymentDeleteModalComponent } from '../payment-delete-modal.component';
import { Subscription } from 'rxjs';

type FilterColumn = 'transactionId' | 'userId' | 'type' | 'amount' | 'status' | 'paymentDate' | 'actions';

@Component({
  selector: 'lib-admin-payments-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PaymentDetailPanelComponent, PaymentDeleteModalComponent],
  templateUrl: './payments-list.component.html',
  styleUrl: '../payments.scss'
})
export class PaymentsListComponent implements OnInit, OnDestroy {
  payments: AdminPaymentItem[] = [];
  loading = true;
  loadError: string | null = null;
  totalItems = 0;

  readonly headerColumns: { key: FilterColumn; label: string }[] = [
    { key: 'transactionId', label: 'ID транзакции' },
    { key: 'userId', label: 'Пользователь' },
    { key: 'type', label: 'Тип' },
    { key: 'amount', label: 'Сумма' },
    { key: 'status', label: 'Статус' },
    { key: 'paymentDate', label: 'Дата платежа' },
    { key: 'actions', label: 'Действия' },
  ];

  activeFilterColumn: FilterColumn | null = null;
  filterMenuStyle: Record<string, string> = {};

  serverFilters = {
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

  currentPage = 1;
  totalPages = 1;
  limit = 10;
  readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);

  selectedPaymentForView: AdminPaymentItem | null = null;
  selectedPaymentForDelete: AdminPaymentItem | null = null;

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
    this.loadError = null;

    const query: PaymentQuery = {
      page: this.currentPage,
      limit: this.limit,
      statuses: this.serverFilters.statuses,
      types: this.serverFilters.type !== null ? [this.serverFilters.type] : [],
      dateFrom: this.serverFilters.dateFrom || undefined,
      dateTo: this.serverFilters.dateTo || undefined
    };

    this.sub?.unsubscribe();
    this.sub = this.api.listPayments(query).subscribe({
      next: (res) => {
        this.payments = res.payments;
        this.totalPages = res.meta?.totalPages || 1;
        this.totalItems = res.meta?.totalItems || 0;
        this.loading = false;
      },
      error: (err) => {
        console.error('Не удалось загрузить платежи', err);
        this.loadError = 'Не удалось загрузить данные платежей с сервера';
        this.payments = [];
        this.loading = false;
      }
    });
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadPayments();
    }
  }

  isFilterable(column: FilterColumn): boolean {
    return column === 'status' || column === 'type' || column === 'paymentDate';
  }

  toggleColumnFilter(column: FilterColumn, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeFilterColumn === column) {
      this.activeFilterColumn = null;
      this.filterMenuStyle = {};
      return;
    }

    this.activeFilterColumn = column;
    this.positionFilterMenu(event);
  }

  private positionFilterMenu(event: MouseEvent): void {
    const trigger = event.target as HTMLElement;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 270;
    const menuMaxHeight = 360;
    const gap = 8;

    let left = rect.right - menuWidth;
    let top = rect.bottom + gap;

    if (left < gap) {
      left = rect.left;
    }
    if (left + menuWidth > window.innerWidth - gap) {
      left = window.innerWidth - menuWidth - gap;
    }
    if (top + menuMaxHeight > window.innerHeight - gap) {
      top = rect.top - menuMaxHeight - gap;
    }
    if (top < gap) {
      top = gap;
    }

    this.filterMenuStyle = {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
    };
  }

  closeColumnFilter(): void {
    this.activeFilterColumn = null;
    this.filterMenuStyle = {};
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadPayments();
    this.closeColumnFilter();
  }

  cancelColumnFilter(): void {
    this.closeColumnFilter();
  }

  clearCurrentFilter(): void {
    if (this.activeFilterColumn === 'status') {
      this.serverFilters.statuses = [];
    } else if (this.activeFilterColumn === 'type') {
      this.serverFilters.type = null;
    } else if (this.activeFilterColumn === 'paymentDate') {
      this.serverFilters.dateFrom = '';
      this.serverFilters.dateTo = '';
    }
    this.applyFilters();
  }

  toggleStatusFilter(status: PaymentStatus): void {
    const idx = this.serverFilters.statuses.indexOf(status);
    if (idx > -1) {
      this.serverFilters.statuses.splice(idx, 1);
    } else {
      this.serverFilters.statuses.push(status);
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeColumnFilter();
  }

  addPayment(): void {
    this.router.navigate(['/admin', 'payments', 'new']);
  }

  openDetail(payment: AdminPaymentItem): void {
    this.selectedPaymentForView = payment;
  }

  editPayment(payment: AdminPaymentItem): void {
    this.router.navigate(['/admin', 'payments', payment.id, 'edit']);
  }

  deletePayment(payment: AdminPaymentItem): void {
    this.selectedPaymentForDelete = payment;
  }

  async onDeleteConfirmed(): Promise<void> {
    if (!this.selectedPaymentForDelete) return;
    try {
      // Тут предполагается вызов удаления через API, 
      // но в задаче было сказано просто открывать модалку Липовцева.
      // Если Липовцев делает удаление внутри PaymentDeleteModal, 
      // то нам нужно только обновить список.
      this.loadPayments();
    } finally {
      this.selectedPaymentForDelete = null;
    }
  }

  onDeleteCancelled(): void {
    this.selectedPaymentForDelete = null;
  }

  onPaymentDeleted(id: string): void {
    this.selectedPaymentForView = null;
    this.loadPayments();
  }

  formatAmount(amount: number): string {
    return amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
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
      [PaymentStatus.PENDING]: 'pending',
      [PaymentStatus.COMPLETED]: 'completed',
      [PaymentStatus.FAILED]: 'failed',
      [PaymentStatus.REFUNDED]: 'refunded'
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
      .map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

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
}
 
