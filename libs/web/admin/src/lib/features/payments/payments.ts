import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { buildRpcBaseUrl, TokenStore } from '@notary-portal/ui';
import { Subscription } from 'rxjs';
import {
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
import { AdminPaymentsApiService } from './payments-api.service';
import { PaymentDeleteModalComponent } from './payment-delete-modal.component';

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

type PaginationItem = number | 'ellipsis';

@Component({
  selector: 'lib-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, PaymentDeleteModalComponent],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
})
export class Payments implements OnInit, OnDestroy {
  private readonly csvSeparator = ';';
  private readonly csvNumberFormatter = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  payments: Payment[] = [];
  loading = true;
  loadError: string | null = null;

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

  filterMenuStyle: Record<string, string> = {};

  fee = 0;

  readonly today: string = new Date().toISOString().split('T')[0];

  pageSize = 7;
  currentPage = 1;
  readonly skeletonRows = Array.from({ length: 6 }, (_, index) => index);

  isCreateEditModalOpen = false;
  isViewModalOpen = false;
  isEditMode = false;
  paymentToDelete: Payment | null = null;

  currentPayment: Payment = this.resetPayment();

  private router = inject(Router);
  private readonly api = inject(AdminPaymentsApiService);
  private readonly tokenStore = inject(TokenStore);
  private dataSub?: Subscription;

  async openReceipt(paymentId: string | number): Promise<void> {
    const token = this.tokenStore.getAccessToken();
    if (!token) return;

    try {
      const response = await fetch(`${buildRpcBaseUrl()}/api/payments/${paymentId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;

      const blob = await response.blob();
      const htmlBlob = blob.type === 'application/octet-stream' ? new Blob([blob], { type: 'text/html' }) : blob;
      const objectUrl = URL.createObjectURL(htmlBlob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      // ignore
    }
  }

  async downloadReceipt(paymentId: string | number, fileName?: string): Promise<void> {
    const token = this.tokenStore.getAccessToken();
    if (!token) return;

    try {
      const response = await fetch(`${buildRpcBaseUrl()}/api/payments/${paymentId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName || `receipt-${paymentId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      // ignore
    }
  }

  ngOnInit(): void {
    this.loading = true;
    this.loadError = null;
    this.api.preload();
    this.dataSub = this.api.payments$.subscribe({
      next: (data) => {
        if (data !== null) {
          this.payments = data;
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Failed to load admin payments', err);
        this.payments = [];
        this.loadError = 'Не удалось загрузить данные платежей с сервера';
        this.loading = false;
      },
    });
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
  }

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

  get paginationItems(): PaginationItem[] {
    const total = this.totalPages;
    const current = this.currentPage;

    if (total <= 7) {
      return this.pages;
    }

    const items: PaginationItem[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) {
      items.push('ellipsis');
    }

    for (let page = start; page <= end; page += 1) {
      items.push(page);
    }

    if (end < total - 1) {
      items.push('ellipsis');
    }

    items.push(total);
    return items;
  }

  isPageItem(page: PaginationItem): page is number {
    return typeof page === 'number';
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
    this.currentPayment = this.resetPayment();
    this.currentPayment.id = this.getNextLocalId();
    this.fee = 0;
    this.isCreateEditModalOpen = true;
  }

  private getNextLocalId(): number {
    const numericIds = this.payments
      .map((payment) => Number(payment.id))
      .filter((id) => Number.isFinite(id));

    return Math.max(...numericIds, 0) + 1;
  }

  openEditModal(payment: Payment): void {
    this.closeModals();
    this.isEditMode = true;
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
    this.paymentToDelete = { ...payment };
  }

  onDeleteConfirmed(): void {
    if (!this.paymentToDelete) return;

    // TODO: replace mock delete with real API call after backend delete endpoint is ready
    this.payments = this.payments.filter((p) => p.id !== this.paymentToDelete?.id);
    this.paymentToDelete = null;
    this.router.navigate(['/admin', 'payments']);
  }

  onDeleteCancelled(): void {
    this.paymentToDelete = null;
  }

  closeModals(): void {
    this.isCreateEditModalOpen = false;
    this.isViewModalOpen = false;
    this.paymentToDelete = null;
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

  exportToCsv(): void {
    const csvContent = this.buildCsvContent(this.filteredPayments);
    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
      this.filterMenuStyle = {};
      return;
    }

    this.activeFilterColumn = column;
    this.filterSearch = '';
    this.filterSortDraft = this.currentSortColumn === column ? this.currentSortDirection : '';
    const allValues = this.getUniqueColumnValues(column);
    const selected = this.columnSelectedValues[column];
    this.filterSelectedDraft = new Set(selected.length ? selected : allValues);

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

  private escapeCsvValue(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
  }

  private formatCsvDate(value: string): string {
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) return value;
    return `${day}.${month}.${year}`;
  }

  private buildCsvContent(payments: Payment[]): string {
    const rows = payments.map((payment) => [
      String(payment.id),
      this.formatCsvDate(payment.paymentDate),
      payment.payer,
      this.getTypeLabel(payment.type),
      this.csvNumberFormatter.format(payment.amount),
      this.csvNumberFormatter.format(payment.fee ?? 0),
      this.getMethodLabel(payment.paymentMethod),
      payment.transactionId || '—',
      payment.attachmentFileName || '—',
      payment.assessmentId || payment.subscriptionId || '—',
      this.getStatusLabel(payment.status),
    ]);

    const header = [
      'ID',
      'Дата платежа',
      'Плательщик',
      'Тип',
      'Сумма',
      'Комиссия',
      'Метод оплаты',
      'ID транзакции',
      'Чек',
      'Заявка/подписка',
      'Статус',
    ];

    return [header, ...rows]
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(this.csvSeparator))
      .join('\r\n');
  }
}
