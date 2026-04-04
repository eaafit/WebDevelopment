import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { inject } from '@angular/core';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from '../payments/payments.shared';

export interface Application {
  id: number;
  date: string;
  sender: string;
  recipient: string;
  type: PaymentType;
  amount: number;
  fee: number;
  paymentMethod?: PaymentMethod;
  transactionId?: string;
  receiptFileName?: string;
  receiptFileUrl?: string;
  statementId?: string;
  status: PaymentStatus;
  statusText: string;
}

@Component({
  selector: 'lib-applications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './applications.html',
  styleUrl: './applications.scss',
})
export class Applications {
  applications: Application[] = [
    {
      id: 5001,
      date: '2025-03-15',
      sender: 'ООО "Ромашка"',
      recipient: 'ИП Иванов',
      type: 'Assessment',
      amount: 12500,
      fee: 125,
      status: 'completed',
      statusText: 'Успешно',
      paymentMethod: 'card',
      transactionId: 'txn_app_5001',
      receiptFileName: 'receipt_5001.pdf',
      receiptFileUrl: '/receipts/receipt_5001.pdf',
      statementId: 'stmt_5001',
    },
    {
      id: 5002,
      date: '2025-03-14',
      sender: 'Петров В.К.',
      recipient: 'Сидорова Е.М.',
      type: 'Subscription',
      amount: 5400.5,
      fee: 54,
      status: 'pending',
      statusText: 'В обработке',
      paymentMethod: 'invoice',
      statementId: 'stmt_5002',
    },
    {
      id: 5003,
      date: '2025-03-13',
      sender: 'ООО "ТехноСервис"',
      recipient: 'ООО "Ромашка"',
      type: 'DocumentCopy',
      amount: 8700.75,
      fee: 87,
      status: 'failed',
      statusText: 'Ошибка',
      paymentMethod: 'card',
      transactionId: 'txn_app_5003',
    },
    {
      id: 5004,
      date: '2025-03-12',
      sender: 'ИП Иванов',
      recipient: 'ООО "ТехноСервис"',
      type: 'Assessment',
      amount: 2100,
      fee: 21,
      status: 'refunded',
      statusText: 'Возврат',
      paymentMethod: 'cash',
      transactionId: 'txn_app_5004',
      receiptFileName: 'receipt_5004.pdf',
      receiptFileUrl: '/receipts/receipt_5004.pdf',
      statementId: 'stmt_5004',
    },
  ];

  searchTerm = '';
  statusFilter: '' | PaymentStatus = '';
  readonly headerColumns: { key: FilterColumn; label: string }[] = [
    { key: 'id', label: 'ID' },
    { key: 'date', label: 'Дата' },
    { key: 'sender', label: 'Отправитель' },
    { key: 'recipient', label: 'Получатель' },
    { key: 'type', label: 'Тип' },
    { key: 'amount', label: 'Сумма' },
    { key: 'fee', label: 'Комиссия' },
    { key: 'paymentMethod', label: 'Метод оплаты' },
    { key: 'transactionId', label: 'ID транзакции' },
    { key: 'receipt', label: 'Чек' },
    { key: 'statement', label: 'Заявление' },
    { key: 'status', label: 'Статус' },
    { key: 'actions', label: 'Действия' },
  ];

  activeFilterColumn: FilterColumn | null = null;
  columnSelectedValues: Record<FilterColumn, string[]> = {
    id: [],
    date: [],
    sender: [],
    recipient: [],
    type: [],
    amount: [],
    fee: [],
    paymentMethod: [],
    transactionId: [],
    receipt: [],
    statement: [],
    status: [],
    actions: [],
  };

  currentSortColumn: FilterColumn | null = null;
  currentSortDirection: '' | 'asc' | 'desc' = '';
  filterSearch = '';
  filterSortDraft: '' | 'asc' | 'desc' = '';
  filterSelectedDraft = new Set<string>();

  readonly today: string = new Date().toISOString().split('T')[0];

  pageSize = 7;
  currentPage = 1;

  isCreateEditModalOpen = false;
  isViewModalOpen = false;
  isDeleteModalOpen = false;
  isEditMode = false;

  currentApplication: Application = this.resetApplication();

  private router = inject(Router);
  private route = inject(ActivatedRoute);

  constructor() {
    this.route.queryParams.subscribe((params) => {
      const id = params['assessmentId'];
      if (id) this.searchTerm = String(id);
    });
  }

  get filteredApplications(): Application[] {
    const term = this.searchTerm.trim().toLowerCase();
    const status = this.statusFilter;

    const filtered = this.applications.filter((a) => {
      const matchesStatus = !status || a.status === status;
      const matchesTerm =
        !term ||
        a.sender.toLowerCase().includes(term) ||
        a.recipient.toLowerCase().includes(term) ||
        a.id.toString().includes(term) ||
        (a.transactionId?.toLowerCase().includes(term) ?? false) ||
        (a.statementId?.toLowerCase().includes(term) ?? false);

      const matchesColumnFilters = this.matchesColumnFilters(a);

      return matchesStatus && matchesTerm && matchesColumnFilters;
    });

    return [...filtered].sort((a, b) => this.compareByActiveSort(a, b));
  }

  get paginatedApplications(): Application[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredApplications.slice(start, end);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredApplications.length / this.pageSize));
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

  private resetApplication(): Application {
    return {
      id: 0,
      date: this.today,
      sender: '',
      recipient: '',
      type: 'Assessment',
      amount: 0,
      fee: 0,
      paymentMethod: 'card',
      status: 'pending',
      statusText: PAYMENT_STATUS_LABELS.pending,
    };
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.currentApplication = this.resetApplication();
    this.currentApplication.id = Math.max(...this.applications.map((a) => a.id), 0) + 1;
    this.isCreateEditModalOpen = true;
  }

  openEditModal(app: Application): void {
    this.isEditMode = true;
    this.currentApplication = { ...app };
    this.isCreateEditModalOpen = true;
  }

  openViewModal(app: Application): void {
    this.currentApplication = { ...app };
    this.isViewModalOpen = true;
  }

  openDeleteModal(app: Application): void {
    this.currentApplication = { ...app };
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

  saveApplication(): void {
    this.currentApplication.statusText = PAYMENT_STATUS_LABELS[this.currentApplication.status];
    if (this.isEditMode) {
      const index = this.applications.findIndex((a) => a.id === this.currentApplication.id);
      if (index !== -1) this.applications[index] = { ...this.currentApplication };
    } else {
      this.applications.push({ ...this.currentApplication });
    }
    this.closeModals();
  }

  deleteApplication(): void {
    this.applications = this.applications.filter((a) => a.id !== this.currentApplication.id);
    this.closeModals();
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

  setDraftSort(direction: 'asc' | 'desc'): void {
    this.filterSortDraft = direction;
  }

  isSortDraftActive(direction: 'asc' | 'desc'): boolean {
    return this.filterSortDraft === direction;
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

  onToggleAllChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.toggleAllValues(!!target?.checked);
  }

  onToggleValueChange(value: string, event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.toggleValue(value, !!target?.checked);
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
    this.activeFilterColumn = null;
  }

  cancelColumnFilter(): void {
    this.activeFilterColumn = null;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeFilterColumn = null;
  }

  getCellValue(app: Application, column: FilterColumn): string {
    switch (column) {
      case 'id':
        return String(app.id);
      case 'date':
        return app.date;
      case 'sender':
        return app.sender;
      case 'recipient':
        return app.recipient;
      case 'type':
        return this.getTypeLabel(app.type);
      case 'amount':
        return String(app.amount);
      case 'fee':
        return String(app.fee ?? 0);
      case 'paymentMethod':
        return this.getMethodLabel(app.paymentMethod);
      case 'transactionId':
        return app.transactionId || '—';
      case 'receipt':
        return app.receiptFileName || '—';
      case 'statement':
        return app.statementId || '—';
      case 'status':
        return this.getStatusLabel(app.status);
      case 'actions':
        return 'Просмотр, Редактировать, Удалить';
      default:
        return '';
    }
  }

  private matchesColumnFilters(app: Application): boolean {
    for (const column of this.headerColumns.map((item) => item.key)) {
      const selected = this.columnSelectedValues[column];
      if (!selected.length) continue;
      const value = this.getCellValue(app, column);
      if (!selected.includes(value)) return false;
    }
    return true;
  }

  private getUniqueColumnValues(column: FilterColumn): string[] {
    const values = new Set<string>();
    for (const app of this.applications) {
      values.add(this.getCellValue(app, column));
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'ru'));
  }

  private compareByActiveSort(a: Application, b: Application): number {
    if (!this.currentSortColumn || !this.currentSortDirection) return 0;
    const left = this.getCellValue(a, this.currentSortColumn);
    const right = this.getCellValue(b, this.currentSortColumn);
    const result = left.localeCompare(right, 'ru', { numeric: true });
    return this.currentSortDirection === 'asc' ? result : -result;
  }

  goToPayments(): void {
    this.router.navigate(['/admin', 'payments']);
  }
}

type FilterColumn =
  | 'id'
  | 'date'
  | 'sender'
  | 'recipient'
  | 'type'
  | 'amount'
  | 'fee'
  | 'paymentMethod'
  | 'transactionId'
  | 'receipt'
  | 'statement'
  | 'status'
  | 'actions';
