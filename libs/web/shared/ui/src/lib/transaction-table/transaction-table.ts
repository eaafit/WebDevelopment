import {
  type PaginationMeta,
  type TransactionHistoryItem,
  type TransactionHistoryStatus,
  type TransactionHistoryType,
} from '@notary-portal/api-contracts';
import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

export interface TransactionTableFilters {
  searchQuery: string;
  status: TransactionHistoryStatus | 'all';
  dateFrom: string;
  dateTo: string;
}

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
};

@Component({
  selector: 'lib-transaction-table',
  imports: [RouterLink, FormsModule],
  templateUrl: './transaction-table.html',
  styleUrl: './transaction-table.scss',
})
export class TransactionTable implements OnChanges {
  @Input() transactions: TransactionHistoryItem[] = [];
  @Input() filters: TransactionTableFilters = DEFAULT_FILTERS;
  @Input() meta: PaginationMeta | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;

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

  draftFilters: TransactionTableFilters = { ...DEFAULT_FILTERS };

  ngOnChanges(): void {
    this.draftFilters = { ...this.filters };
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

  trackByTransaction(index: number, transaction: TransactionHistoryItem): string {
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

  getStatusLabel(status: TransactionHistoryStatus): string {
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

  getStatusClass(status: TransactionHistoryStatus): string {
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

  getTypeLabel(type: TransactionHistoryType): string {
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

  getDocumentPresentation(transaction: TransactionHistoryItem): TransactionDocumentPresentation {
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

  canShowDocument(transaction: TransactionHistoryItem): boolean {
    return Boolean(
      transaction.attachmentFileUrl &&
        (transaction.status === 'completed' || transaction.status === 'refunded'),
    );
  }

  getUnavailableDocumentPresentation(
    transaction: TransactionHistoryItem,
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

  getVisibleRangeStart(meta: PaginationMeta): number {
    if (meta.totalItems === 0) {
      return 0;
    }

    return (meta.currentPage - 1) * meta.perPage + 1;
  }

  getVisibleRangeEnd(meta: PaginationMeta, itemsCount: number): number {
    if (meta.totalItems === 0 || itemsCount === 0) {
      return 0;
    }

    return Math.min(this.getVisibleRangeStart(meta) + itemsCount - 1, meta.totalItems);
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
