import {
  type PaginationMeta,
  type TransactionHistoryItem,
  type TransactionHistoryQuery,
  type TransactionHistoryStatus,
} from '@notary-portal/api-contracts';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { TransactionTable, type TransactionTableFilters } from '@notary-portal/ui';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { TransactionsApiService } from './transactions-api.service';

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
  readonly transactions = signal<TransactionHistoryItem[]>([]);
  readonly filters = computed(() => this.queryState().filters);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly api = inject(TransactionsApiService);
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
            map((response) => ({ ok: true as const, response })),
            catchError(() =>
              of({
                ok: false as const,
                error:
                  'Не удалось загрузить историю транзакций. Проверьте API и повторите попытку.',
              }),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);

        if (result.ok) {
          this.transactions.set(result.response.transactions);
          this.meta.set(result.response.meta);
          return;
        }

        this.transactions.set([]);
        this.meta.set(null);
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

  private buildQuery(page: number, filters: TransactionTableFilters): TransactionHistoryQuery {
    const statuses: TransactionHistoryStatus[] | undefined =
      filters.status === 'all' ? undefined : [filters.status];

    return {
      page,
      limit: PAGE_SIZE,
      searchQuery: filters.searchQuery.trim() || undefined,
      statuses,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    };
  }
}
