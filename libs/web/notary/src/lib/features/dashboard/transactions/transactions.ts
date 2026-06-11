import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  TransactionTable,
  type TransactionItem,
  type TransactionPageMeta,
  type TransactionStatus,
  type TransactionTableFilters,
  WebLoggerService,
} from '@notary-portal/ui';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { TransactionsApiService, type TransactionsHistoryQuery } from './transactions-api.service';

const DEFAULT_FILTERS: TransactionTableFilters = {
  searchQuery: '',
  status: 'all',
  dateFrom: '',
  dateTo: '',
};
const PAGE_SIZE = 10;

@Component({
  selector: 'lib-transactions',
  imports: [TransactionTable],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss',
})
export class Transactions {
  readonly transactions = signal<TransactionItem[]>([]);
  readonly filters = signal<TransactionTableFilters>({ ...DEFAULT_FILTERS });
  readonly meta = signal<TransactionPageMeta | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly api = inject(TransactionsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly logger = inject(WebLoggerService);
  private readonly queryState = signal({
    page: 1,
    filters: DEFAULT_FILTERS,
  });

  constructor() {
    this.logInfo('transaction.history.notary.page_opened');
    toObservable(this.queryState)
      .pipe(
        tap(({ page, filters }) => {
          this.loading.set(true);
          this.error.set(null);
          this.logInfo('transaction.history.notary.load_started', {
            query: this.toLogQuery(this.buildQuery(page, filters)),
          });
        }),
        switchMap(({ page, filters }) => {
          const query = this.buildQuery(page, filters);

          return this.api.getTransactionHistory(query).pipe(
            map((response) => ({ ok: true as const, response, filters, query })),
            catchError((err) => {
              this.logError('transaction.history.notary.load_failed', err, {
                query: this.toLogQuery(query),
              });

              return of({
                ok: false as const,
                error: extractTransactionsError(err),
                query,
              });
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);

        if (result.ok) {
          this.transactions.set(result.response.transactions);
          this.meta.set(result.response.meta);
          this.filters.set(result.filters);
          this.logInfo('transaction.history.notary.load_succeeded', {
            query: this.toLogQuery(result.query),
            returnedItems: result.response.transactions.length,
            totalItems: result.response.meta?.totalItems ?? null,
            totalPages: result.response.meta?.totalPages ?? null,
          });
          return;
        }

        this.error.set(result.error);
      });
  }

  onFiltersApply(filters: TransactionTableFilters): void {
    const normalizedFilters = {
      ...DEFAULT_FILTERS,
      ...filters,
      searchQuery: filters.searchQuery.trim(),
    };

    this.logInfo('transaction.history.notary.filters_applied', {
      filters: this.toLogFilters(normalizedFilters),
    });
    this.queryState.set({
      page: 1,
      filters: normalizedFilters,
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page === this.meta()?.currentPage) {
      this.logInfo('transaction.history.notary.page_change_ignored', {
        requestedPage: page,
        currentPage: this.meta()?.currentPage ?? null,
      });
      return;
    }

    this.logInfo('transaction.history.notary.page_changed', {
      previousPage: this.meta()?.currentPage ?? null,
      nextPage: page,
    });
    this.queryState.update((state) => ({
      ...state,
      page,
    }));
  }

  onReceiptOpen(transaction: TransactionItem): void {
    void this.openReceipt(transaction);
  }

  private buildQuery(page: number, filters: TransactionTableFilters): TransactionsHistoryQuery {
    const status: TransactionStatus | undefined =
      filters.status === 'all' ? undefined : filters.status;

    return {
      page,
      limit: PAGE_SIZE,
      searchQuery: filters.searchQuery.trim() || undefined,
      status,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    };
  }

  private async openReceipt(transaction: TransactionItem): Promise<void> {
    this.error.set(null);
    this.logInfo('transaction.history.notary.receipt_open_requested', {
      paymentId: transaction.id,
      transactionId: transaction.transactionId,
      status: transaction.status,
      receiptStatus: transaction.receiptStatus,
      hasReceipt: transaction.hasReceipt,
    });

    try {
      await this.api.openReceipt(transaction);
      this.logInfo('transaction.history.notary.receipt_open_succeeded', {
        paymentId: transaction.id,
        transactionId: transaction.transactionId,
      });
    } catch (error) {
      this.logError('transaction.history.notary.receipt_open_failed', error, {
        paymentId: transaction.id,
        transactionId: transaction.transactionId,
        status: transaction.status,
        receiptStatus: transaction.receiptStatus,
      });
      this.error.set(extractReceiptError(error));
    }
  }

  private logInfo(event: string, context: Record<string, unknown> = {}): void {
    this.logger.info(event, {
      area: 'notary_transactions_history',
      route: '/notary/transactions',
      ...context,
    });
  }

  private logError(event: string, error: unknown, context: Record<string, unknown> = {}): void {
    this.logger.error(event, {
      area: 'notary_transactions_history',
      route: '/notary/transactions',
      ...context,
      error,
    });
  }

  private toLogQuery(query: TransactionsHistoryQuery): Record<string, unknown> {
    return {
      page: query.page,
      limit: query.limit,
      hasSearchQuery: Boolean(query.searchQuery),
      searchQueryLength: query.searchQuery?.length ?? 0,
      status: query.status ?? 'all',
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
    };
  }

  private toLogFilters(filters: TransactionTableFilters): Record<string, unknown> {
    return {
      hasSearchQuery: Boolean(filters.searchQuery.trim()),
      searchQueryLength: filters.searchQuery.trim().length,
      status: filters.status,
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
    };
  }
}

function extractTransactionsError(err: unknown): string {
  const message = getErrorMessage(err);

  if (!message) {
    return 'Не удалось загрузить историю транзакций. Проверьте API и повторите попытку.';
  }

  if (/failed to fetch|fetch failed|networkerror/i.test(message)) {
    return 'Не удалось подключиться к API. Убедитесь, что backend запущен и доступен.';
  }

  if (/session expired|unauthenticated|unauthorized|401/i.test(message)) {
    return 'Сессия истекла или недействительна. Войдите снова.';
  }

  return `Не удалось загрузить историю транзакций: ${message}`;
}

function getErrorMessage(err: unknown): string | null {
  if (!err) {
    return null;
  }

  if (typeof err === 'string') {
    return err;
  }

  if (typeof err === 'object') {
    const withRawMessage = err as { rawMessage?: unknown; message?: unknown };
    if (typeof withRawMessage.rawMessage === 'string' && withRawMessage.rawMessage.trim()) {
      return withRawMessage.rawMessage.trim();
    }
    if (typeof withRawMessage.message === 'string' && withRawMessage.message.trim()) {
      return withRawMessage.message.trim();
    }
  }

  return null;
}

function extractReceiptError(err: unknown): string {
  const message = getErrorMessage(err);

  if (!message) {
    return 'Не удалось открыть чек. Попробуйте ещё раз.';
  }

  if (/receipt is not ready yet|ещё формируется/i.test(message)) {
    return 'Чек ещё формируется. Попробуйте открыть его немного позже.';
  }

  if (/receipt not found|receipt file is missing|чек не найден/i.test(message)) {
    return 'Чек пока недоступен или отсутствует в хранилище.';
  }

  if (/object storage unavailable/i.test(message)) {
    return 'Не удалось получить чек из хранилища. Попробуйте позже.';
  }

  if (/session expired|unauthenticated|unauthorized|401/i.test(message)) {
    return 'Сессия истекла или недействительна. Войдите снова.';
  }

  return `Не удалось открыть чек: ${message}`;
}
