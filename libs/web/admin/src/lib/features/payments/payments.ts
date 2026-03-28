import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  TransactionTable,
  type TransactionItem,
  type TransactionPageMeta,
  type TransactionStatus,
  type TransactionTableFilters,
} from '@notary-portal/ui';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { AdminPaymentsApiService, type AdminPaymentsHistoryQuery } from './payments-api.service';

const DEFAULT_FILTERS: TransactionTableFilters = {
  searchQuery: '',
  status: 'all',
  type: 'all',
  dateFrom: '',
  dateTo: '',
};
const PAGE_SIZE = 15;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Component({
  selector: 'lib-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, TransactionTable],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
})
export class AdminPayments {
  readonly transactions = signal<TransactionItem[]>([]);
  readonly filters = signal<TransactionTableFilters>({ ...DEFAULT_FILTERS });
  readonly meta = signal<TransactionPageMeta | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Черновик поля «пользователь» до применения (кнопка или общий запрос). */
  userIdDraft = '';

  private readonly api = inject(AdminPaymentsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queryState = signal({
    page: 1,
    filters: DEFAULT_FILTERS,
    userId: '' as string,
  });

  constructor() {
    toObservable(this.queryState)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(({ page, filters, userId }) =>
          this.api.getPaymentHistory(this.buildQuery(page, filters, userId)).pipe(
            map((response) => ({ ok: true as const, response, filters })),
            catchError((err) => {
              console.error('Admin: failed to load payments', err);
              return of({
                ok: false as const,
                error: extractPaymentsError(err),
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
      userId: this.normalizedUserId(this.queryState().userId),
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

  applyUserFilter(): void {
    const uid = this.normalizedUserId(this.userIdDraft);
    this.userIdDraft = uid;
    this.queryState.set({
      page: 1,
      filters: { ...this.queryState().filters },
      userId: uid,
    });
  }

  clearUserFilter(): void {
    this.userIdDraft = '';
    this.queryState.set({
      page: 1,
      filters: { ...this.queryState().filters },
      userId: '',
    });
  }

  private buildQuery(
    page: number,
    filters: TransactionTableFilters,
    userId: string,
  ): AdminPaymentsHistoryQuery {
    const status: TransactionStatus | undefined =
      filters.status === 'all' ? undefined : filters.status;
    const type = filters.type === 'all' ? undefined : filters.type;

    return {
      page,
      limit: PAGE_SIZE,
      userId: userId || undefined,
      searchQuery: filters.searchQuery.trim() || undefined,
      status,
      type,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    };
  }

  private normalizedUserId(raw: string): string {
    const t = raw.trim();
    if (!t) {
      return '';
    }
    return UUID_PATTERN.test(t) ? t : '';
  }
}

function extractPaymentsError(err: unknown): string {
  const message = getErrorMessage(err);

  if (!message) {
    return 'Не удалось загрузить платежи. Проверьте API и повторите попытку.';
  }

  if (/failed to fetch|fetch failed|networkerror/i.test(message)) {
    return 'Не удалось подключиться к API. Убедитесь, что backend запущен и доступен.';
  }

  if (/session expired|unauthenticated|unauthorized|401/i.test(message)) {
    return 'Сессия истекла или недействительна. Войдите снова.';
  }

  return `Не удалось загрузить платежи: ${message}`;
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
