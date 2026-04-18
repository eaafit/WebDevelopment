import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type {
  TransactionItem,
  TransactionPageMeta,
  TransactionReceiptStatus,
  TransactionStatus,
  TransactionTableCopyVariant,
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
  dateFrom: '',
  dateTo: '',
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
  yookassa_widget: {
    label: 'ЮKassa',
    caption: 'Способ оплаты отобразится после подтверждения',
    icon: '💠',
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
  @Input() copyVariant: TransactionTableCopyVariant = 'transactions';
  @Input() filters: TransactionTableFilters = DEFAULT_FILTERS;
  @Input() meta: TransactionPageMeta | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;

  @Output() readonly filtersApply = new EventEmitter<TransactionTableFilters>();
  @Output() readonly pageChange = new EventEmitter<number>();
  @Output() readonly receiptOpen = new EventEmitter<TransactionItem>();

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

  draftFilters: TransactionTableFilters = { ...DEFAULT_FILTERS };

  get pageTitle(): string {
    return this.copyVariant === 'payments' ? 'История платежей' : 'История транзакций';
  }

  get listTitle(): string {
    return this.copyVariant === 'payments' ? 'Список платежей' : 'Список транзакций';
  }

  get summaryEmptyStateText(): string {
    return this.copyVariant === 'payments'
      ? 'По выбранным условиям платежи не найдены.'
      : 'По выбранным условиям транзакции не найдены.';
  }

  get tableEmptyStateText(): string {
    return this.copyVariant === 'payments'
      ? 'Платежи по выбранным фильтрам не найдены.'
      : 'Транзакции по выбранным фильтрам не найдены.';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters']) {
      this.draftFilters = { ...this.filters };
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

  openReceipt(transaction: TransactionItem): void {
    if (!this.canShowDocument(transaction)) {
      return;
    }

    this.receiptOpen.emit(transaction);
  }

  trackByTransaction(index: number, transaction: TransactionItem): string {
    return transaction.id || `${index}`;
  }

  hasActiveFilters(filters: TransactionTableFilters): boolean {
    return Boolean(
      filters.searchQuery || filters.dateFrom || filters.dateTo || filters.status !== 'all',
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
      caption: 'Подробности способа оплаты недоступны',
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
      transaction.hasReceipt &&
        transaction.attachmentFileUrl &&
        (transaction.status === 'completed' || transaction.status === 'refunded'),
    );
  }

  getUnavailableDocumentPresentation(
    transaction: TransactionItem,
  ): TransactionDocumentUnavailablePresentation {
    if (transaction.status === 'completed' && transaction.receiptStatus === 'failed') {
      return {
        label: 'Чек недоступен',
        icon: '⚠️',
      };
    }

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
          label: this.getCompletedUnavailableLabel(transaction.receiptStatus),
          icon: transaction.receiptStatus === 'failed' ? '⚠️' : '📭',
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

  private getCompletedUnavailableLabel(receiptStatus: TransactionReceiptStatus): string {
    switch (receiptStatus) {
      case 'pending':
        return 'Чек ещё формируется';
      case 'failed':
        return 'Чек недоступен';
      case 'available':
      case 'unspecified':
      default:
        return 'Документ ещё не сформирован';
    }
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
