import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  TransactionTable,
  type TransactionItem,
  type TransactionPageMeta,
  type TransactionStatus,
  type TransactionTableFilters,
} from '@notary-portal/ui';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { PaymentsApiService, type PaymentsHistoryQuery } from './payments-api.service';

const DEFAULT_FILTERS: TransactionTableFilters = {
  searchQuery: '',
  status: 'all',
  dateFrom: '',
  dateTo: '',
};
const PAGE_SIZE = 10;

@Component({
  selector: 'lib-payments',
  imports: [TransactionTable],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
})
export class Payments {
  readonly transactions = signal<TransactionItem[]>([]);
  readonly filters = signal<TransactionTableFilters>({ ...DEFAULT_FILTERS });
  readonly meta = signal<TransactionPageMeta | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly api = inject(PaymentsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queryState = signal({
    page: 1,
    filters: DEFAULT_FILTERS,
  });

  constructor() {
    toObservable(this.queryState)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(({ page, filters }) =>
          this.api.getTransactionHistory(this.buildQuery(page, filters)).pipe(
            map((response) => ({ ok: true as const, response, filters })),
            catchError((err) => {
              console.error('Failed to load transaction history', err);

              return of({
                ok: false as const,
                error: extractTransactionsError(err),
              });
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);

        if (result.ok) {
          this.transactions.set(result.response.transactions);
          this.meta.set(result.response.meta);
          this.filters.set(result.filters);
          return;
        }

        this.error.set(result.error);
      });
  }

  onFiltersApply(filters: TransactionTableFilters): void {
    this.queryState.set({
      page: 1,
      filters: {
        ...DEFAULT_FILTERS,
        ...filters,
        searchQuery: filters.searchQuery.trim(),
      },
    });
  }

  onPageChange(page: number): void {
    if (page < 1 || page === this.meta()?.currentPage) {
      return;
    }

    this.queryState.update((state) => ({
      ...state,
      page,
    }));
  }

  onReceiptOpen(transaction: TransactionItem): void {
    void this.openReceipt(transaction);
  }

  private buildQuery(page: number, filters: TransactionTableFilters): PaymentsHistoryQuery {
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

    try {
      await this.api.openReceipt(transaction);
    } catch (error) {
      console.error('Failed to open payment receipt', error);
      this.error.set(extractReceiptError(error));
    }
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
