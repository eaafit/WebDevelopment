import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type {
  TransactionItem,
  TransactionPageMeta,
  TransactionStatus,
  TransactionTableFilters,
  TransactionType,
} from './transaction-table.models';

interface PaymentMethodPresentation {
  label: string;
  caption: string;
  icon: string;
  iconType: 'emoji' | 'asset';
}

interface TransactionDocumentPresentation {
  label: string;
  icon: string;
}

interface TransactionDocumentUnavailablePresentation {
  label: string;
  icon: string;
}

const DEFAULT_FILTERS: TransactionTableFilters = {
  searchQuery: '',
  status: 'all',
  type: 'all',
  dateFrom: '',
  dateTo: '',
};

type ColumnId = 'date' | 'user' | 'description' | 'amount' | 'method' | 'status' | 'documents';
type SortDirection = 'asc' | 'desc';
type SortKey =
  | 'paymentDate'
  | 'userId'
  | 'description'
  | 'amount'
  | 'paymentMethod'
  | 'status'
  | 'type';

interface ColumnDefinition {
  id: ColumnId;
  label: string;
  width: number;
  minWidth: number;
  maxWidth: number;
  sortable: boolean;
}

const COLUMN_DEFINITIONS: Record<ColumnId, ColumnDefinition> = {
  date: {
    id: 'date',
    label: 'Дата',
    width: 140,
    minWidth: 120,
    maxWidth: 240,
    sortable: true,
  },
  user: {
    id: 'user',
    label: 'Пользователь',
    width: 220,
    minWidth: 170,
    maxWidth: 320,
    sortable: true,
  },
  description: {
    id: 'description',
    label: 'Описание',
    width: 360,
    minWidth: 240,
    maxWidth: 520,
    sortable: true,
  },
  amount: {
    id: 'amount',
    label: 'Сумма',
    width: 140,
    minWidth: 120,
    maxWidth: 220,
    sortable: true,
  },
  method: {
    id: 'method',
    label: 'Способ',
    width: 260,
    minWidth: 200,
    maxWidth: 380,
    sortable: true,
  },
  status: {
    id: 'status',
    label: 'Статус',
    width: 140,
    minWidth: 120,
    maxWidth: 220,
    sortable: true,
  },
  documents: {
    id: 'documents',
    label: 'Документы',
    width: 280,
    minWidth: 220,
    maxWidth: 420,
    sortable: false,
  },
};

const COLUMN_ORDER: ColumnId[] = [
  'date',
  'user',
  'description',
  'amount',
  'method',
  'status',
  'documents',
];

const STATUS_SORT_ORDER: Record<TransactionStatus, number> = {
  pending: 1,
  completed: 2,
  failed: 3,
  refunded: 4,
};

const TYPE_SORT_ORDER: Record<TransactionType, number> = {
  subscription: 1,
  assessment: 2,
  document_copy: 3,
};

const DEFAULT_COLUMN_VISIBILITY: Record<ColumnId, boolean> = {
  date: true,
  user: true,
  description: true,
  amount: true,
  method: true,
  status: true,
  documents: true,
};

const DEFAULT_COLUMN_WIDTHS: Record<ColumnId, number> = {
  date: COLUMN_DEFINITIONS.date.width,
  user: COLUMN_DEFINITIONS.user.width,
  description: COLUMN_DEFINITIONS.description.width,
  amount: COLUMN_DEFINITIONS.amount.width,
  method: COLUMN_DEFINITIONS.method.width,
  status: COLUMN_DEFINITIONS.status.width,
  documents: COLUMN_DEFINITIONS.documents.width,
};

const PAYMENT_METHOD_PRESENTATIONS: Record<string, PaymentMethodPresentation> = {
  bank_card: {
    label: 'Банковская карта',
    caption: 'Visa, Mastercard или Мир',
    icon: '💳',
    iconType: 'emoji',
  },
  sbp: {
    label: 'СБП',
    caption: 'Система быстрых платежей',
    icon: '/payment-methods/sbp.svg',
    iconType: 'asset',
  },
  invoice: {
    label: 'Счёт на оплату',
    caption: 'Безналичный перевод по реквизитам',
    icon: '🏦',
    iconType: 'emoji',
  },
  bank_transfer: {
    label: 'Банковский перевод',
    caption: 'Перевод через банк',
    icon: '🏛️',
    iconType: 'emoji',
  },
  cash: {
    label: 'Наличные',
    caption: 'Оплата в офисе',
    icon: '💵',
    iconType: 'emoji',
  },
  apple_pay: {
    label: 'Apple Pay',
    caption: 'Оплата с телефона',
    icon: '📱',
    iconType: 'emoji',
  },
  google_pay: {
    label: 'Google Pay',
    caption: 'Оплата с телефона',
    icon: '📱',
    iconType: 'emoji',
  },
  mir_pay: {
    label: 'Mir Pay',
    caption: 'Оплата в одно касание',
    icon: '📲',
    iconType: 'emoji',
  },
  sber_pay: {
    label: 'SberPay',
    caption: 'Оплата через Сбер',
    icon: '📲',
    iconType: 'emoji',
  },
};

@Component({
  selector: 'lib-transaction-table',
  imports: [RouterLink, FormsModule],
  templateUrl: './transaction-table.html',
  styleUrl: './transaction-table.scss',
})
export class TransactionTable implements OnChanges {
  @Input() transactions: TransactionItem[] = [];
  @Input() filters: TransactionTableFilters = DEFAULT_FILTERS;
  @Input() meta: TransactionPageMeta | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;
  /** Заголовок страницы (например, для админки). */
  @Input() pageTitle = 'История транзакций';
  /** Подзаголовок под заголовком. */
  @Input() pageSubtitle = 'Список всех ваших транзакций и документы к ним.';
  /** Ссылка «назад» и кнопка пополнения — только для ЛК нотариуса. */
  @Input() showNotaryChrome = true;
  /** Колонка с UUID пользователя (админский просмотр всех платежей). */
  @Input() showUserColumn = false;

  @Output() readonly filtersApply = new EventEmitter<TransactionTableFilters>();
  @Output() readonly pageChange = new EventEmitter<number>();

  readonly today = getTodayInputValue();
  private readonly dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  private readonly timeFormatter = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  private readonly collator = new Intl.Collator('ru-RU', { sensitivity: 'base', numeric: true });

  draftFilters: TransactionTableFilters = { ...DEFAULT_FILTERS };
  columnVisibility: Record<ColumnId, boolean> = { ...DEFAULT_COLUMN_VISIBILITY };
  columnWidths: Record<ColumnId, number> = { ...DEFAULT_COLUMN_WIDTHS };
  sortState: { key: SortKey; direction: SortDirection } = {
    key: 'paymentDate',
    direction: 'desc',
  };
  selectedTransaction: TransactionItem | null = null;
  isResizing = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters']) {
      this.draftFilters = { ...this.filters };
    }

    if (changes['showUserColumn']) {
      if (!this.showUserColumn) {
        this.columnVisibility.user = false;
      } else if (changes['showUserColumn'].previousValue === false && !this.columnVisibility.user) {
        this.columnVisibility.user = true;
      }
    }
  }

  submitFilters(): void {
    this.filtersApply.emit({
      ...DEFAULT_FILTERS,
      ...this.draftFilters,
      searchQuery: this.draftFilters.searchQuery.trim(),
    });
  }

  resetFilters(): void {
    this.draftFilters = { ...DEFAULT_FILTERS };
    this.filtersApply.emit({ ...DEFAULT_FILTERS });
  }

  get displayedTransactions(): TransactionItem[] {
    return this.sortTransactions(this.transactions);
  }

  toggleSort(key: SortKey): void {
    if (this.sortState.key === key) {
      this.sortState = {
        key,
        direction: this.sortState.direction === 'asc' ? 'desc' : 'asc',
      };
      return;
    }

    this.sortState = {
      key,
      direction: this.getDefaultSortDirection(key),
    };
  }

  getSortIcon(key: SortKey): string {
    const direction = this.getSortDirection(key);
    if (!direction) {
      return '↕';
    }
    return direction === 'asc' ? '↑' : '↓';
  }

  getSortDirection(key: SortKey): SortDirection | null {
    return this.sortState.key === key ? this.sortState.direction : null;
  }

  getAriaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    const direction = this.getSortDirection(key);
    if (!direction) {
      return 'none';
    }
    return direction === 'asc' ? 'ascending' : 'descending';
  }

  isColumnVisible(column: ColumnId): boolean {
    if (column === 'user' && !this.showUserColumn) {
      return false;
    }
    return this.columnVisibility[column];
  }

  canToggleColumn(column: ColumnId): boolean {
    if (!this.isColumnVisible(column)) {
      return true;
    }
    return this.visibleColumnsCount > 1;
  }

  toggleColumnVisibility(column: ColumnId): void {
    if (!this.isColumnVisible(column)) {
      this.columnVisibility[column] = true;
      return;
    }

    if (this.visibleColumnsCount <= 1) {
      return;
    }

    this.columnVisibility[column] = false;
  }

  getColumnLabel(column: ColumnId): string {
    return COLUMN_DEFINITIONS[column].label;
  }

  isColumnSortable(column: ColumnId): boolean {
    return COLUMN_DEFINITIONS[column].sortable;
  }

  get columnSettings(): ColumnDefinition[] {
    return COLUMN_ORDER.filter((column) => (column === 'user' ? this.showUserColumn : true)).map(
      (column) => COLUMN_DEFINITIONS[column],
    );
  }

  getColumnWidth(column: ColumnId): number {
    return this.columnWidths[column];
  }

  resetTableView(): void {
    this.columnVisibility = { ...DEFAULT_COLUMN_VISIBILITY };
    if (!this.showUserColumn) {
      this.columnVisibility.user = false;
    }
    this.columnWidths = { ...DEFAULT_COLUMN_WIDTHS };
    this.sortState = { key: 'paymentDate', direction: 'desc' };
  }

  startColumnResize(column: ColumnId, event: PointerEvent): void {
    if (!this.isColumnVisible(column)) {
      return;
    }

    const handle = event.target as HTMLElement | null;
    const header = handle?.closest('th') as HTMLElement | null;
    if (!header) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = header.getBoundingClientRect().width;
    const { minWidth, maxWidth } = COLUMN_DEFINITIONS[column];

    this.isResizing = true;
    document.body.style.userSelect = 'none';

    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(
        maxWidth,
        Math.max(minWidth, startWidth + (moveEvent.clientX - startX)),
      );
      this.columnWidths[column] = Math.round(nextWidth);
    };

    const onStop = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onStop);
      window.removeEventListener('pointercancel', onStop);
      this.isResizing = false;
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onStop, { once: true });
    window.addEventListener('pointercancel', onStop, { once: true });
  }

  exportCsv(): void {
    if (this.displayedTransactions.length === 0) {
      return;
    }

    const headers = [
      'ID платежа',
      'ID транзакции',
      'Пользователь',
      'Тип',
      'Статус',
      'Дата',
      'Время',
      'Сумма',
      'Валюта',
      'Способ оплаты',
      'Описание',
      'Документ',
      'Ссылка на документ',
      'ID подписки',
      'ID оценки',
    ];

    const rows = this.displayedTransactions.map((transaction) => [
      transaction.id,
      transaction.transactionId ?? '',
      transaction.userId,
      this.getTypeLabel(transaction.type),
      this.getStatusLabel(transaction.status),
      this.formatTransactionDate(transaction.paymentDate),
      this.formatTransactionTime(transaction.paymentDate),
      transaction.amount,
      transaction.currency,
      this.getPaymentMethodPresentation(transaction.paymentMethod).label,
      transaction.description,
      transaction.attachmentFileName ?? '',
      transaction.attachmentFileUrl ?? '',
      transaction.subscriptionId ?? '',
      transaction.assessmentId ?? '',
    ]);

    const csv = this.buildCsv([headers, ...rows]);
    const filename = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  openDetails(transaction: TransactionItem): void {
    this.selectedTransaction = transaction;
  }

  closeDetails(): void {
    this.selectedTransaction = null;
  }

  onBackdropClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.classList.contains('transaction-modal-backdrop')) {
      this.closeDetails();
    }
  }

  onBackdropKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (
      target?.classList.contains('transaction-modal-backdrop') &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      event.preventDefault();
      this.closeDetails();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.selectedTransaction) {
      this.closeDetails();
    }
  }

  goToPreviousPage(): void {
    if (!this.meta || this.meta.currentPage <= 1) {
      return;
    }

    this.pageChange.emit(this.meta.currentPage - 1);
  }

  goToNextPage(): void {
    if (!this.meta || this.meta.currentPage >= this.meta.totalPages) {
      return;
    }

    this.pageChange.emit(this.meta.currentPage + 1);
  }

  private sortTransactions(transactions: TransactionItem[]): TransactionItem[] {
    if (transactions.length === 0) {
      return transactions;
    }

    const { key, direction } = this.sortState;
    const multiplier = direction === 'asc' ? 1 : -1;

    return [...transactions].sort((a, b) => {
      const aValue = this.getSortValue(a, key);
      const bValue = this.getSortValue(b, key);
      return this.compareSortValues(aValue, bValue) * multiplier;
    });
  }

  private getDefaultSortDirection(key: SortKey): SortDirection {
    return key === 'paymentDate' || key === 'amount' ? 'desc' : 'asc';
  }

  private getSortValue(transaction: TransactionItem, key: SortKey): string | number {
    switch (key) {
      case 'paymentDate':
        return Date.parse(transaction.paymentDate) || 0;
      case 'amount':
        return Number(transaction.amount) || 0;
      case 'status':
        return STATUS_SORT_ORDER[transaction.status] ?? 0;
      case 'type':
        return TYPE_SORT_ORDER[transaction.type] ?? 0;
      case 'userId':
        return transaction.userId;
      case 'description':
        return transaction.description;
      case 'paymentMethod':
        return this.getPaymentMethodPresentation(transaction.paymentMethod).label;
    }
  }

  private compareSortValues(a: string | number, b: string | number): number {
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }

    return this.collator.compare(String(a), String(b));
  }

  private buildCsv(rows: Array<Array<string | number>>): string {
    return rows
      .map((row) => row.map((value) => this.escapeCsvValue(String(value ?? ''))).join(';'))
      .join('\r\n');
  }

  private escapeCsvValue(value: string): string {
    const sanitized = value.replace(/\r?\n/g, ' ').replace(/"/g, '""');
    return `"${sanitized}"`;
  }

  trackByTransaction(index: number, transaction: TransactionItem): string {
    return transaction.id || `${index}`;
  }

  hasActiveFilters(filters: TransactionTableFilters): boolean {
    return Boolean(
      filters.searchQuery ||
        filters.dateFrom ||
        filters.dateTo ||
        filters.status !== 'all' ||
        filters.type !== 'all',
    );
  }

  getActiveFilterChips(filters: TransactionTableFilters): string[] {
    const chips: string[] = [];

    if (filters.searchQuery) {
      chips.push(`Поиск: ${filters.searchQuery}`);
    }

    if (filters.status !== 'all') {
      chips.push(`Статус: ${this.getStatusLabel(filters.status)}`);
    }

    if (filters.type !== 'all') {
      chips.push(`Тип: ${this.getTypeLabel(filters.type)}`);
    }

    if (filters.dateFrom && filters.dateTo) {
      chips.push(`Период: ${filters.dateFrom} - ${filters.dateTo}`);
    } else if (filters.dateFrom) {
      chips.push(`С ${filters.dateFrom}`);
    } else if (filters.dateTo) {
      chips.push(`До ${filters.dateTo}`);
    }

    return chips;
  }

  formatAmount(amount: string, currency: string): string {
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount)) {
      return amount;
    }

    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  }

  formatTransactionDate(paymentDate: string): string {
    const parsedDate = new Date(paymentDate);

    if (Number.isNaN(parsedDate.getTime())) {
      return paymentDate;
    }

    return this.dateFormatter.format(parsedDate).replace(/\s?г\.$/, '');
  }

  formatTransactionTime(paymentDate: string): string {
    const parsedDate = new Date(paymentDate);

    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    return this.timeFormatter.format(parsedDate);
  }

  getStatusLabel(status: TransactionStatus): string {
    switch (status) {
      case 'completed':
        return 'Оплачено';
      case 'pending':
        return 'В обработке';
      case 'failed':
        return 'Ошибка';
      case 'refunded':
        return 'Возврат';
    }
  }

  getStatusClass(status: TransactionStatus): string {
    switch (status) {
      case 'completed':
        return 'badge badge-success';
      case 'pending':
        return 'badge badge-pending';
      case 'failed':
        return 'badge badge-failed';
      case 'refunded':
        return 'badge badge-refunded';
    }
  }

  getTypeLabel(type: TransactionType): string {
    switch (type) {
      case 'subscription':
        return 'Подписка';
      case 'assessment':
        return 'Оценка';
      case 'document_copy':
        return 'Копия документа';
    }
  }

  getPaymentMethodPresentation(paymentMethod: string | null): PaymentMethodPresentation {
    if (!paymentMethod) {
      return {
        label: 'Не указан',
        caption: 'Способ оплаты не был передан',
        icon: '❔',
        iconType: 'emoji',
      };
    }

    const normalizedMethod = paymentMethod.trim().toLowerCase();
    const knownPresentation = PAYMENT_METHOD_PRESENTATIONS[normalizedMethod];

    if (knownPresentation) {
      return knownPresentation;
    }

    return {
      label: humanizePaymentMethod(normalizedMethod),
      caption: `Код платёжного шлюза: ${paymentMethod}`,
      icon: '💠',
      iconType: 'emoji',
    };
  }

  getDocumentPresentation(transaction: TransactionItem): TransactionDocumentPresentation {
    if (transaction.status === 'refunded') {
      return {
        label: 'Документ возврата',
        icon: '↩️',
      };
    }

    if (transaction.paymentMethod === 'invoice') {
      return {
        label: 'Счёт и квитанция',
        icon: '🏦',
      };
    }

    return {
      label: 'Открыть чек',
      icon: '🧾',
    };
  }

  canShowDocument(transaction: TransactionItem): boolean {
    return Boolean(
      transaction.attachmentFileUrl &&
        (transaction.status === 'completed' || transaction.status === 'refunded'),
    );
  }

  getUnavailableDocumentPresentation(
    transaction: TransactionItem,
  ): TransactionDocumentUnavailablePresentation {
    switch (transaction.status) {
      case 'pending':
        return {
          label: 'Документ появится после оплаты',
          icon: '⏳',
        };
      case 'failed':
        return {
          label: 'Документы недоступны',
          icon: '⚠️',
        };
      case 'refunded':
        return {
          label: 'Документ возврата отсутствует',
          icon: '↩️',
        };
      case 'completed':
        return {
          label: 'Документ ещё не сформирован',
          icon: '📭',
        };
    }
  }

  getVisibleRangeStart(meta: TransactionPageMeta): number {
    if (meta.totalItems === 0) {
      return 0;
    }

    return (meta.currentPage - 1) * meta.perPage + 1;
  }

  getVisibleRangeEnd(meta: TransactionPageMeta, itemsCount: number): number {
    if (meta.totalItems === 0 || itemsCount === 0) {
      return 0;
    }

    return Math.min(this.getVisibleRangeStart(meta) + itemsCount - 1, meta.totalItems);
  }

  get visibleColumnsCount(): number {
    return COLUMN_ORDER.filter((column) => this.isColumnVisible(column)).length;
  }

  get tableColspan(): number {
    return Math.max(1, this.visibleColumnsCount);
  }
}

function humanizePaymentMethod(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function getTodayInputValue(): string {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().split('T')[0];
}
