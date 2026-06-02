import { ChangeDetectorRef, Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import {
  PaymentStatus as RpcPaymentStatus,
  PaymentType as RpcPaymentType,
} from '@notary-portal/api-contracts';
import { buildRpcBaseUrl, TokenStore, WebLoggerService } from '@notary-portal/ui';
import { Subscription } from 'rxjs';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_OPTIONS,
  PAYMENT_TYPE_LABELS,
  PAYMENT_TYPE_OPTIONS,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from './payments.shared';
import { AdminPaymentsApiService, type PaymentQuery } from '../../api/admin-payments-api.service';
import { PaymentDeleteModalComponent } from './payment-delete-modal.component';
import { AdminUserApiService } from '../RequestAssessment/services/user-api.service';

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
  totalItems = 0;
  serverTotalPages = 1;
  loading = true;
  exporting = false;
  loadError: string | null = null;
  exportError: string | null = null;

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

  pageSize = 10;
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
  private readonly logger = inject(WebLoggerService);
  private readonly userApi = inject(AdminUserApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private dataSub?: Subscription;
  private loadSub?: Subscription;
  private filterReloadTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  private viewRefreshQueued = false;

  async openReceipt(paymentId: string | number): Promise<void> {
    this.logInfo('payment.admin.receipt_open_requested', { paymentId: String(paymentId) });
    const token = this.tokenStore.getAccessToken();
    if (!token) {
      this.logWarn('payment.admin.receipt_open_blocked_no_token', { paymentId: String(paymentId) });
      return;
    }

    try {
      const response = await fetch(`${buildRpcBaseUrl()}/api/payments/${paymentId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        this.logWarn('payment.admin.receipt_open_rejected', {
          paymentId: String(paymentId),
          status: response.status,
        });
        return;
      }

      const blob = await response.blob();
      const htmlBlob =
        blob.type === 'application/octet-stream' ? new Blob([blob], { type: 'text/html' }) : blob;
      const objectUrl = URL.createObjectURL(htmlBlob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      this.logInfo('payment.admin.receipt_open_succeeded', { paymentId: String(paymentId) });
    } catch (error) {
      this.logError('payment.admin.receipt_open_failed', error, { paymentId: String(paymentId) });
    }
  }

  async downloadReceipt(paymentId: string | number, fileName?: string): Promise<void> {
    this.logInfo('payment.admin.receipt_download_requested', {
      paymentId: String(paymentId),
      fileName: fileName ?? null,
    });
    const token = this.tokenStore.getAccessToken();
    if (!token) {
      this.logWarn('payment.admin.receipt_download_blocked_no_token', {
        paymentId: String(paymentId),
      });
      return;
    }

    try {
      const response = await fetch(`${buildRpcBaseUrl()}/api/payments/${paymentId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        this.logWarn('payment.admin.receipt_download_rejected', {
          paymentId: String(paymentId),
          status: response.status,
        });
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName || `receipt-${paymentId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      this.logInfo('payment.admin.receipt_download_succeeded', {
        paymentId: String(paymentId),
      });
    } catch (error) {
      this.logError('payment.admin.receipt_download_failed', error, {
        paymentId: String(paymentId),
      });
    }
  }

  ngOnInit(): void {
    this.logInfo('payment.admin.list_init_started');
    this.loading = true;
    this.loadError = null;
    this.userApi.loadUsers().catch(() => undefined);
    this.api.preload();
    this.dataSub = this.api.payments$.subscribe({
      next: (data) => {
        if (data !== null) {
          this.payments = data;
          this.loading = false;
          this.logInfo('payment.admin.list_loaded', { total: data.length });
          this.requestViewRefresh();
        }
      },
      error: (err) => {
        this.logError('payment.admin.list_load_failed', err);
        this.payments = [];
        this.loadError = 'Не удалось загрузить данные платежей с сервера';
        this.loading = false;
        this.requestViewRefresh();
      },
    });
    this.loadPayments();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.logInfo('payment.admin.list_destroyed');
    this.dataSub?.unsubscribe();
    this.loadSub?.unsubscribe();
    if (this.filterReloadTimer) {
      clearTimeout(this.filterReloadTimer);
    }
    this.unlockBodyScroll();
  }

  get filteredPayments(): Payment[] {
    return this.applyLocalFilters(this.payments);
  }

  get paginatedPayments(): Payment[] {
    return this.filteredPayments;
  }

  get totalPages(): number {
    return Math.max(1, this.serverTotalPages);
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
    this.loadPayments();
  }

  prevPage(): void {
    this.setPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.setPage(this.currentPage + 1);
  }

  onFiltersChanged(): void {
    this.currentPage = 1;
    this.schedulePaymentsLoad();
  }

  private resetPayment(): Payment {
    return {
      id: 0,
      userId: '',
      paymentDate: this.today,
      payer: '',
      amount: 0,
      currency: 'RUB',
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
    this.lockBodyScroll();
    this.logInfo('payment.admin.create_modal_opened', {
      draftPaymentId: String(this.currentPayment.id),
    });
  }

  private getNextLocalId(): number {
    const numericIds = this.payments
      .map((payment) => Number(payment.id))
      .filter((id) => Number.isFinite(id));

    return Math.max(...numericIds, 0) + 1;
  }

  openEditModal(payment: Payment): void {
    this.logInfo('payment.admin.edit_open_requested', { paymentId: String(payment.id) });
    this.router.navigate(['/admin', 'payments', payment.id, 'edit']);
  }

  openViewModal(payment: Payment): void {
    this.closeModals();
    this.currentPayment = { ...payment };
    this.isViewModalOpen = true;
    this.lockBodyScroll();
    this.logInfo('payment.admin.view_opened', { paymentId: String(payment.id) });
  }

  openDeleteModal(payment: Payment): void {
    this.closeModals();
    this.paymentToDelete = { ...payment };
    this.lockBodyScroll();
    this.logInfo('payment.admin.delete_modal_opened', { paymentId: String(payment.id) });
  }

  async onDeleteConfirmed(): Promise<void> {
    if (!this.paymentToDelete) {
      this.logWarn('payment.admin.delete_confirmed_without_target');
      return;
    }

    const deleted = this.paymentToDelete;
    this.paymentToDelete = null;
    this.logInfo('payment.admin.delete_requested', { paymentId: String(deleted.id) });

    try {
      await this.api.deletePayment(String(deleted.id));
      this.payments = this.payments.filter((p) => String(p.id) !== String(deleted.id));
      this.logInfo('payment.admin.delete_succeeded', { paymentId: String(deleted.id) });
    } catch (err) {
      this.logError('payment.admin.delete_failed', err, { paymentId: String(deleted.id) });
      this.loadError = err instanceof Error ? err.message : 'Ошибка при удалении платежа';
    }
  }

  onDeleteCancelled(): void {
    this.paymentToDelete = null;
    this.logInfo('payment.admin.delete_cancelled');
  }

  closeModals(): void {
    this.isCreateEditModalOpen = false;
    this.isViewModalOpen = false;
    this.paymentToDelete = null;
    this.unlockBodyScroll();
  }

  private lockBodyScroll(): void {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  private unlockBodyScroll(): void {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
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
    this.logInfo('payment.admin.save_redirect_to_form', {
      paymentId: String(this.currentPayment.id),
    });
    this.closeModals();
    this.router.navigate(['/admin', 'payments', this.currentPayment.id, 'edit']);
  }

  async deletePayment(): Promise<void> {
    this.logInfo('payment.admin.delete_from_view_requested', {
      paymentId: String(this.currentPayment.id),
    });
    this.loading = true;
    this.loadError = null;

    try {
      await this.api.deletePayment(String(this.currentPayment.id));
      this.closeModals();
      this.logInfo('payment.admin.delete_from_view_succeeded', {
        paymentId: String(this.currentPayment.id),
      });
    } catch (err) {
      this.logError('payment.admin.delete_from_view_failed', err, {
        paymentId: String(this.currentPayment.id),
      });
      this.loadError = err instanceof Error ? err.message : 'Ошибка при удалении платежа';
      this.loading = false;
    }
  }

  goToApplications(payment?: Payment): void {
    const extras = payment?.assessmentId
      ? { queryParams: { assessmentId: payment.assessmentId } }
      : undefined;
    this.logInfo('payment.admin.navigate_applications', {
      paymentId: payment ? String(payment.id) : null,
      assessmentId: payment?.assessmentId ?? null,
    });
    this.router.navigate(['/admin', 'applications'], extras);
  }

  exportToCsv(): void {
    const exportPayments = this.filteredPayments;
    this.logInfo('payment.admin.export_csv_started', {
      rows: exportPayments.length,
      page: this.currentPage,
    });
    this.loadError = null;
    this.exportError = null;

    if (!exportPayments.length) {
      this.logWarn('payment.admin.export_csv_skipped_empty');
      this.exportError = 'No payments in current selection for CSV export';
      this.requestViewRefresh();
      return;
    }

    this.exporting = true;
    try {
      this.downloadCsv(this.buildCsvContent(exportPayments));
      this.logInfo('payment.admin.export_csv_succeeded', {
        rows: exportPayments.length,
      });
    } catch (err) {
      this.logError('payment.admin.export_csv_failed', err);
      this.exportError = err instanceof Error ? err.message : 'Failed to export payments as CSV';
    } finally {
      this.exporting = false;
      this.requestViewRefresh();
    }
  }
  goToApplication(assessmentId: string): void {
    this.logInfo('payment.admin.navigate_application', { assessmentId });
    this.router.navigate(['/admin', 'applications'], {
      queryParams: { assessmentId },
    });
  }

  getTypeLabel(type: PaymentType): string {
    return PAYMENT_TYPE_LABELS[type];
  }

  getMethodLabel(method?: PaymentMethod): string {
    return method ? (PAYMENT_METHOD_LABELS[method] ?? method) : '—';
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
    const shouldReload = this.usesServerFilter(this.activeFilterColumn);
    this.columnSelectedValues[this.activeFilterColumn] = [];
    if (this.currentSortColumn === this.activeFilterColumn) {
      this.currentSortColumn = null;
      this.currentSortDirection = '';
      this.filterSortDraft = '';
    }
    this.filterSearch = '';
    this.filterSelectedDraft = new Set(this.getUniqueColumnValues(this.activeFilterColumn));
    this.currentPage = 1;
    if (shouldReload) {
      this.loadPayments();
    }
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
    const shouldReload = this.usesServerFilter(column);
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
    if (shouldReload) {
      this.loadPayments();
    }
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
    return PAYMENT_STATUS_OPTIONS;
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
    this.logInfo('payment.admin.create_form_opened');
    this.router.navigate(['/admin', 'payments', 'new']);
  }

  private logInfo(event: string, context: Record<string, unknown> = {}): void {
    this.logger.info(event, this.buildLogContext(context));
  }

  private logWarn(event: string, context: Record<string, unknown> = {}): void {
    this.logger.warn(event, this.buildLogContext(context));
  }

  private logError(event: string, error: unknown, context: Record<string, unknown> = {}): void {
    this.logger.error(event, this.buildLogContext({ ...context, error }));
  }

  private buildLogContext(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      area: 'admin_payments_list',
      route: '/admin/payments',
      totalPayments: this.payments.length,
      filteredPayments: this.filteredPayments.length,
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      ...extra,
    };
  }

  getCellValue(payment: Payment, column: FilterColumn): string {
    switch (column) {
      case 'id':
        return String(payment.id);
      case 'paymentDate':
        return payment.paymentDate;
      case 'payer':
        return this.getPayerName(payment);
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

  private loadPayments(): void {
    if (this.filterReloadTimer) {
      clearTimeout(this.filterReloadTimer);
      this.filterReloadTimer = undefined;
    }

    this.loadSub?.unsubscribe();
    this.loading = true;
    this.loadError = null;

    this.loadSub = this.api.listPayments(this.buildQuery()).subscribe({
      next: (page) => {
        this.payments = page.payments;
        this.totalItems = page.meta?.totalItems ?? page.payments.length;
        this.serverTotalPages = page.meta?.totalPages ?? 1;
        this.currentPage = page.meta?.currentPage ?? this.currentPage;
        this.loading = false;
        this.requestViewRefresh();
      },
      error: (err) => {
        this.payments = [];
        this.totalItems = 0;
        this.serverTotalPages = 1;
        this.loadError =
          err instanceof Error ? err.message : 'Не удалось загрузить данные платежей с сервера';
        this.loading = false;
        this.requestViewRefresh();
      },
    });
  }

  private requestViewRefresh(): void {
    if (this.viewRefreshQueued) {
      return;
    }

    this.viewRefreshQueued = true;
    queueMicrotask(() => {
      this.viewRefreshQueued = false;
      if (!this.destroyed) {
        this.cdr.detectChanges();
      }
    });
  }

  private schedulePaymentsLoad(): void {
    if (this.filterReloadTimer) {
      clearTimeout(this.filterReloadTimer);
    }

    this.filterReloadTimer = setTimeout(() => this.loadPayments(), 250);
  }

  private buildQuery(): PaymentQuery {
    return {
      ...this.buildQueryFilters(),
      page: this.currentPage,
      limit: this.pageSize,
    };
  }

  private buildQueryFilters(): Partial<Omit<PaymentQuery, 'page' | 'limit'>> {
    const searchQuery = this.searchTerm.trim();

    return {
      searchQuery: searchQuery || undefined,
      statuses: this.resolveStatusFilters(),
      types: this.resolveTypeFilters(),
    };
  }

  private resolveStatusFilters(): RpcPaymentStatus[] {
    if (this.statusFilter) {
      return [toRpcPaymentStatus(this.statusFilter)];
    }

    const selectedLabels = this.columnSelectedValues.status;
    if (!selectedLabels.length) {
      return [];
    }

    return PAYMENT_STATUS_OPTIONS.filter((status) =>
      selectedLabels.includes(this.getStatusLabel(status)),
    ).map((status) => toRpcPaymentStatus(status));
  }

  private resolveTypeFilters(): RpcPaymentType[] {
    const selectedLabels = this.columnSelectedValues.type;
    if (!selectedLabels.length) {
      return [];
    }

    return PAYMENT_TYPE_OPTIONS.filter((type) =>
      selectedLabels.includes(this.getTypeLabel(type)),
    ).map((type) => toRpcPaymentType(type));
  }

  private applyLocalFilters(payments: Payment[]): Payment[] {
    const filtered = payments.filter((payment) => this.matchesColumnFilters(payment));
    return [...filtered].sort((a, b) => this.compareByActiveSort(a, b));
  }

  private usesServerFilter(column: FilterColumn): boolean {
    return column === 'type' || column === 'status';
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

  getPayerName(payment: Payment): string {
    const userId = payment.userId;
    if (userId) {
      return this.userApi.getUserName(userId);
    }
    return payment.payer || '—';
  }

  shortId(id: string | null | undefined): string {
    if (!id) return '—';
    if (id.length <= 12) return id;
    return id.slice(0, 8) + '…';
  }

  private getUniqueColumnValues(column: FilterColumn): string[] {
    if (column === 'type') {
      return PAYMENT_TYPE_OPTIONS.map((type) => this.getTypeLabel(type));
    }

    if (column === 'status') {
      return PAYMENT_STATUS_OPTIONS.map((status) => this.getStatusLabel(status));
    }

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
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private buildCsvContent(payments: Payment[]): string {
    const rows = payments.map((payment) => [
      String(payment.id),
      this.formatCsvDate(payment.paymentDate),
      payment.payer,
      this.getTypeLabel(payment.type),
      `${this.csvNumberFormatter.format(payment.amount)} ${payment.currency || 'RUB'}`,
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

  private downloadCsv(csvContent: string): void {
    if (!csvContent.trim()) {
      throw new Error('CSV file is empty');
    }

    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = this.buildCsvFileName();
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.append(link);

    try {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  }

  private buildCsvFileName(): string {
    const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
    return `payments-${stamp}.csv`;
  }
}

function toRpcPaymentStatus(status: PaymentStatus): RpcPaymentStatus {
  switch (status) {
    case 'completed':
      return RpcPaymentStatus.COMPLETED;
    case 'failed':
      return RpcPaymentStatus.FAILED;
    case 'refunded':
      return RpcPaymentStatus.REFUNDED;
    case 'pending':
    default:
      return RpcPaymentStatus.PENDING;
  }
}

function toRpcPaymentType(type: PaymentType): RpcPaymentType {
  switch (type) {
    case 'Subscription':
      return RpcPaymentType.SUBSCRIPTION;
    case 'DocumentCopy':
      return RpcPaymentType.DOCUMENT_COPY;
    case 'Assessment':
    default:
      return RpcPaymentType.ASSESSMENT;
  }
}
