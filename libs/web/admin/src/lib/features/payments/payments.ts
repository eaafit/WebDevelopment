import { Component, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import {
  MOCK_PAYMENTS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  PAYMENT_TYPE_OPTIONS,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from './payments.shared';

type FilterColumn =
  | 'id'
  | 'paymentDate'
  | 'payer'
  | 'type'
  | 'amount'
  | 'fee'
  | 'paymentMethod'
  | 'transactionId'
  | 'attachment'
  | 'application'
  | 'status'
  | 'actions';

@Component({
  selector: 'lib-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
})
export class Payments {
  @ViewChild('paymentForm') paymentForm?: NgForm;

  payments: Payment[] = MOCK_PAYMENTS.map((payment) => ({ ...payment }));

  searchTerm = '';
  statusFilter: '' | PaymentStatus = '';
  readonly headerColumns: { key: FilterColumn; label: string }[] = [
    { key: 'id', label: 'ID' },
    { key: 'paymentDate', label: 'Дата' },
    { key: 'payer', label: 'Плательщик' },
    { key: 'type', label: 'Тип' },
    { key: 'amount', label: 'Сумма' },
    { key: 'fee', label: 'Комиссия' },
    { key: 'paymentMethod', label: 'Метод' },
    { key: 'transactionId', label: 'ID транзакции' },
    { key: 'attachment', label: 'Чек' },
    { key: 'application', label: 'Заявка' },
    { key: 'status', label: 'Статус' },
    { key: 'actions', label: 'Действия' },
  ];

  activeFilterColumn: FilterColumn | null = null;
  columnSelectedValues: Record<FilterColumn, string[]> = {
    id: [],
    paymentDate: [],
    payer: [],
    type: [],
    amount: [],
    fee: [],
    paymentMethod: [],
    transactionId: [],
    attachment: [],
    application: [],
    status: [],
    actions: [],
  };

  currentSortColumn: FilterColumn | null = null;
  currentSortDirection: '' | 'asc' | 'desc' = '';
  filterSearch = '';
  filterSortDraft: '' | 'asc' | 'desc' = '';
  filterSelectedDraft = new Set<string>();

  fee = 0;

  readonly today: string = new Date().toISOString().split('T')[0];

  pageSize = 7;
  currentPage = 1;

  isCreateEditModalOpen = false;
  isViewModalOpen = false;
  isDeleteModalOpen = false;
  isEditMode = false;

  currentPayment: Payment = this.resetPayment();

  private router = inject(Router);

  get filteredPayments(): Payment[] {
    const term = this.searchTerm.trim().toLowerCase();
    const status = this.statusFilter;

    const filtered = this.payments.filter((p) => {
      const matchesStatus = !status || p.status === status;
      const matchesTerm =
        !term ||
        p.payer.toLowerCase().includes(term) ||
        p.id.toString().includes(term) ||
        (p.transactionId?.toLowerCase().includes(term) ?? false);
      const matchesColumnFilters = this.matchesColumnFilters(p);

      return matchesStatus && matchesTerm && matchesColumnFilters;
    });

    return [...filtered].sort((a, b) => this.compareByActiveSort(a, b));
  }

  get paginatedPayments(): Payment[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredPayments.slice(start, end);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredPayments.length / this.pageSize));
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  prevPage(): void {
    this.setPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.setPage(this.currentPage + 1);
  }

  onFiltersChanged(): void {
    this.currentPage = 1;
  }

  private resetPayment(): Payment {
    return {
      id: 0,
      paymentDate: this.today,
      payer: '',
      amount: 0,
      fee: 0,
      status: 'pending',
      statusText: PAYMENT_STATUS_LABELS.pending,
      type: 'Assessment',
      paymentMethod: 'card',
    };
  }

  openCreateModal(): void {
    this.closeModals();
    this.isEditMode = false;
    this.paymentForm?.resetForm();
    this.currentPayment = this.resetPayment();
    this.currentPayment.id = Math.max(...this.payments.map((p) => p.id), 0) + 1;
    this.fee = 0;
    this.isCreateEditModalOpen = true;
  }

  openEditModal(payment: Payment): void {
    this.closeModals();
    this.isEditMode = true;
    this.paymentForm?.resetForm();
    this.currentPayment = { ...payment };
    this.fee = payment.fee ?? 0;
    this.isCreateEditModalOpen = true;
  }

  openViewModal(payment: Payment): void {
    this.closeModals();
    this.currentPayment = { ...payment };
    this.isViewModalOpen = true;
  }

  openDeleteModal(payment: Payment): void {
    this.closeModals();
    this.currentPayment = { ...payment };
    this.isDeleteModalOpen = true;
  }

  closeModals(): void {
    this.isCreateEditModalOpen = false;
    this.isViewModalOpen = false;
    this.isDeleteModalOpen = false;
  }

  onModalBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.closeModals();
    }
  }

  onBackdropKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeModals();
    }
  }

  savePayment(): void {
    this.currentPayment.fee = Number(this.fee ?? 0);
    this.currentPayment.statusText = PAYMENT_STATUS_LABELS[this.currentPayment.status];
    if (this.isEditMode) {
      const index = this.payments.findIndex((p) => p.id === this.currentPayment.id);
      if (index !== -1) this.payments[index] = { ...this.currentPayment };
    } else {
      this.payments.push({ ...this.currentPayment });
    }
    this.closeModals();
  }

  deletePayment(): void {
    this.payments = this.payments.filter((p) => p.id !== this.currentPayment.id);
    this.closeModals();
    this.router.navigate(['/admin', 'payments']);
  }

  goToApplications(payment?: Payment): void {
    const extras = payment?.assessmentId
      ? { queryParams: { assessmentId: payment.assessmentId } }
      : undefined;
    this.router.navigate(['/admin', 'applications'], extras);
  }

  goToApplication(assessmentId: string): void {
    this.router.navigate(['/admin', 'applications'], {
      queryParams: { assessmentId },
    });
  }

  getTypeLabel(type: PaymentType): string {
    return PAYMENT_TYPE_LABELS[type];
  }

  getMethodLabel(method?: PaymentMethod): string {
    return method ? PAYMENT_METHOD_LABELS[method] : '—';
  }

  getStatusLabel(status: PaymentStatus): string {
    return PAYMENT_STATUS_LABELS[status];
  }

  toggleColumnFilter(column: FilterColumn, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeFilterColumn === column) {
      this.activeFilterColumn = null;
      return;
    }

    this.activeFilterColumn = column;
    this.filterSearch = '';
    this.filterSortDraft = this.currentSortColumn === column ? this.currentSortDirection : '';
    const allValues = this.getUniqueColumnValues(column);
    const selected = this.columnSelectedValues[column];
    this.filterSelectedDraft = new Set(selected.length ? selected : allValues);
  }

  closeColumnFilter(): void {
    this.activeFilterColumn = null;
  }

  setDraftSort(direction: 'asc' | 'desc'): void {
    this.filterSortDraft = direction;
  }

  clearCurrentColumnFilter(): void {
    if (!this.activeFilterColumn) return;
    this.columnSelectedValues[this.activeFilterColumn] = [];
    if (this.currentSortColumn === this.activeFilterColumn) {
      this.currentSortColumn = null;
      this.currentSortDirection = '';
      this.filterSortDraft = '';
    }
    this.filterSearch = '';
    this.filterSelectedDraft = new Set(this.getUniqueColumnValues(this.activeFilterColumn));
    this.currentPage = 1;
  }

  get filterValues(): string[] {
    if (!this.activeFilterColumn) return [];
    const all = this.getUniqueColumnValues(this.activeFilterColumn);
    const term = this.filterSearch.trim().toLowerCase();
    if (!term) return all;
    return all.filter((value) => value.toLowerCase().includes(term));
  }

  isValueChecked(value: string): boolean {
    if (!this.activeFilterColumn) return false;
    return this.filterSelectedDraft.has(value);
  }

  toggleValue(value: string, checked: boolean): void {
    if (checked) this.filterSelectedDraft.add(value);
    else this.filterSelectedDraft.delete(value);
  }

  get isAllChecked(): boolean {
    const values = this.filterValues;
    if (!values.length) return false;
    return values.every((value) => this.isValueChecked(value));
  }

  toggleAllValues(checked: boolean): void {
    for (const value of this.filterValues) {
      if (checked) this.filterSelectedDraft.add(value);
      else this.filterSelectedDraft.delete(value);
    }
  }

  onToggleAllChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.toggleAllValues(!!target?.checked);
  }

  onToggleValueChange(value: string, event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.toggleValue(value, !!target?.checked);
  }

  applyColumnFilter(): void {
    if (!this.activeFilterColumn) return;
    const column = this.activeFilterColumn;
    const values = this.getUniqueColumnValues(column);
    const selected = values.filter((value) => this.filterSelectedDraft.has(value));
    this.columnSelectedValues[column] = selected.length === values.length ? [] : selected;

    if (this.filterSortDraft) {
      this.currentSortColumn = column;
      this.currentSortDirection = this.filterSortDraft;
    } else if (this.currentSortColumn === column) {
      this.currentSortColumn = null;
      this.currentSortDirection = '';
    }

    this.currentPage = 1;
    this.closeColumnFilter();
  }

  cancelColumnFilter(): void {
    this.closeColumnFilter();
  }

  isSortDraftActive(direction: 'asc' | 'desc'): boolean {
    return this.filterSortDraft === direction;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeColumnFilter();
  }

  get typeOptions(): PaymentType[] {
    return PAYMENT_TYPE_OPTIONS;
  }

  get paymentMethodOptions(): PaymentMethod[] {
    return PAYMENT_METHOD_OPTIONS;
  }

  get statusOptions(): PaymentStatus[] {
    return Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[];
  }

  get assessmentIdOptions(): string[] {
    return Array.from(
      new Set(this.payments.map((payment) => payment.assessmentId).filter(Boolean)),
    ) as string[];
  }

  get subscriptionIdOptions(): string[] {
    return Array.from(
      new Set(this.payments.map((payment) => payment.subscriptionId).filter(Boolean)),
    ) as string[];
  }

  goToCreateForm(): void {
    this.router.navigate(['/admin', 'payments', 'new']);
  }

  getCellValue(payment: Payment, column: FilterColumn): string {
    switch (column) {
      case 'id':
        return String(payment.id);
      case 'paymentDate':
        return payment.paymentDate;
      case 'payer':
        return payment.payer;
      case 'type':
        return this.getTypeLabel(payment.type);
      case 'amount':
        return String(payment.amount);
      case 'fee':
        return String(payment.fee ?? 0);
      case 'paymentMethod':
        return this.getMethodLabel(payment.paymentMethod);
      case 'transactionId':
        return payment.transactionId || '—';
      case 'attachment':
        return payment.attachmentFileName || '—';
      case 'application':
        return payment.assessmentId || payment.subscriptionId || '—';
      case 'status':
        return this.getStatusLabel(payment.status);
      case 'actions':
        return payment.assessmentId
          ? 'Просмотр, Редактировать, Удалить, Заявка'
          : 'Просмотр, Редактировать, Удалить';
      default:
        return '';
    }
  }

  private matchesColumnFilters(payment: Payment): boolean {
    for (const column of this.headerColumns.map((item) => item.key)) {
      const selected = this.columnSelectedValues[column];
      if (!selected.length) continue;
      const value = this.getCellValue(payment, column);
      if (!selected.includes(value)) return false;
    }
    return true;
  }

  private getUniqueColumnValues(column: FilterColumn): string[] {
    const values = new Set<string>();
    for (const payment of this.payments) {
      values.add(this.getCellValue(payment, column));
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'ru'));
  }

  private compareByActiveSort(a: Payment, b: Payment): number {
    if (!this.currentSortColumn || !this.currentSortDirection) return 0;
    const left = this.getCellValue(a, this.currentSortColumn);
    const right = this.getCellValue(b, this.currentSortColumn);
    const result = left.localeCompare(right, 'ru', { numeric: true });
    return this.currentSortDirection === 'asc' ? result : -result;
  }
}
