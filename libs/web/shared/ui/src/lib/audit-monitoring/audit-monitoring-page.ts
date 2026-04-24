import { CommonModule } from '@angular/common';
import { firstValueFrom, debounceTime, distinctUntilChanged, of } from 'rxjs';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Component, DestroyRef, Input, computed, inject, signal } from '@angular/core';
import { AuditMonitoringApiService } from './audit-monitoring-api.service';
import type {
  AuditMonitoringEvent,
  AuditMonitoringFilters,
  AuditMonitoringMeta,
  AuditMonitoringMode,
} from './audit-monitoring.models';

const PAGE_SIZE = 20;
const CSV_BATCH_SIZE = 200;
const DEFAULT_FILTERS: AuditMonitoringFilters = {
  eventType: '',
  actorQuery: '',
  actorUserId: '',
  targetId: '',
  assessmentId: '',
  dateFrom: '',
  dateTo: '',
};

@Component({
  selector: 'lib-audit-monitoring-page',
  imports: [CommonModule],
  templateUrl: './audit-monitoring-page.html',
  styleUrl: './audit-monitoring-page.scss',
})
export class AuditMonitoringPage {
  @Input() mode: AuditMonitoringMode = 'admin';

  readonly events = signal<AuditMonitoringEvent[]>([]);
  readonly meta = signal<AuditMonitoringMeta | null>(null);
  readonly loading = signal(true);
  readonly hasLoadedOnce = signal(false);
  readonly exporting = signal(false);
  readonly error = signal<string | null>(null);
  readonly draftFilters = signal<AuditMonitoringFilters>({ ...DEFAULT_FILTERS });
  readonly appliedFilters = signal<AuditMonitoringFilters>({ ...DEFAULT_FILTERS });
  readonly currentPage = signal(1);

  private readonly refreshTick = signal(0);
  private readonly selectedEventId = signal<string | null>(null);
  private readonly api = inject(AuditMonitoringApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  private readonly timeFormatter = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  readonly selectedEvent = computed(() => {
    const selectedId = this.selectedEventId();
    const events = this.events();

    if (!events.length) {
      return null;
    }

    return events.find((event) => event.id === selectedId) ?? events[0];
  });

  readonly hasPreviousPage = computed(() => (this.meta()?.currentPage ?? 1) > 1);
  readonly hasNextPage = computed(() => {
    const meta = this.meta();
    return meta ? meta.currentPage < meta.totalPages : false;
  });
  readonly isInitialLoading = computed(() => this.loading() && !this.hasLoadedOnce());
  readonly isRefreshing = computed(() => this.loading() && this.hasLoadedOnce());
  readonly showFatalError = computed(() => Boolean(this.error()) && !this.hasLoadedOnce());
  readonly showInlineError = computed(() => Boolean(this.error()) && this.hasLoadedOnce());
  readonly disableActions = computed(() => this.loading() || this.exporting());
  private readonly requestQuery = computed(() => ({
    filters: this.appliedFilters(),
    page: this.currentPage(),
    refreshTick: this.refreshTick(),
  }));

  constructor() {
    toObservable(this.draftFilters)
      .pipe(
        debounceTime(300),
        map((filters) => normalizeFilters(filters)),
        distinctUntilChanged(areFiltersEqual),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((filters) => {
        if (areFiltersEqual(filters, this.appliedFilters())) {
          return;
        }

        this.currentPage.set(1);
        this.appliedFilters.set(filters);
      });

    toObservable(this.requestQuery)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(({ filters, page }) =>
          this.api.getAuditEvents({ ...filters, page, limit: PAGE_SIZE }).pipe(
            map((result) => ({ ok: true as const, result })),
            catchError((error) =>
              of({
                ok: false as const,
                error: extractAuditError(error),
              }),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.loading.set(false);

        if (!response.ok) {
          this.error.set(response.error);
          if (!this.hasLoadedOnce()) {
            this.events.set([]);
            this.meta.set(null);
            this.selectedEventId.set(null);
          }
          return;
        }

        this.error.set(null);
        this.hasLoadedOnce.set(true);
        this.events.set(response.result.events);
        this.meta.set(response.result.meta);

        const selectedId = this.selectedEventId();
        if (!response.result.events.length) {
          this.selectedEventId.set(null);
          return;
        }

        if (!selectedId || !response.result.events.some((event) => event.id === selectedId)) {
          this.selectedEventId.set(response.result.events[0].id);
        }
      });
  }

  get eyebrow(): string {
    return this.mode === 'notary' ? 'Нотариус / аудит действий' : 'Администратор / аудит действий';
  }

  get title(): string {
    return this.mode === 'notary' ? 'История действий по вашим заказам' : 'История действий';
  }

  get lead(): string {
    return this.mode === 'notary'
      ? 'Лента продуктовых событий ограничена только заказами текущего нотариуса.'
      : 'Реальный product audit trail по действиям пользователей и операциям с заявками.';
  }

  get filtersSummary(): string {
    const meta = this.meta();
    return meta
      ? `Найдено событий: ${meta.totalItems}. Страница ${meta.currentPage} из ${Math.max(meta.totalPages, 1)}.`
      : 'Загрузка событий аудита.';
  }

  updateFilter<K extends keyof AuditMonitoringFilters>(
    key: K,
    value: AuditMonitoringFilters[K],
  ): void {
    this.draftFilters.update((filters) => ({ ...filters, [key]: value }));
  }

  resetFilters(): void {
    const normalizedDraft = normalizeFilters(this.draftFilters());
    const normalizedApplied = normalizeFilters(this.appliedFilters());

    if (
      areFiltersEqual(normalizedDraft, DEFAULT_FILTERS) &&
      areFiltersEqual(normalizedApplied, DEFAULT_FILTERS) &&
      this.currentPage() === 1
    ) {
      return;
    }

    this.draftFilters.set({ ...DEFAULT_FILTERS });
    this.appliedFilters.set({ ...DEFAULT_FILTERS });
    this.currentPage.set(1);
  }

  refresh(): void {
    this.refreshTick.update((value) => value + 1);
  }

  selectEvent(eventId: string): void {
    this.selectedEventId.set(eventId);
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage()) {
      return;
    }

    this.currentPage.update((page) => page - 1);
  }

  goToNextPage(): void {
    if (!this.hasNextPage()) {
      return;
    }

    this.currentPage.update((page) => page + 1);
  }

  async exportCsv(): Promise<void> {
    if (this.exporting()) {
      return;
    }

    this.exporting.set(true);

    try {
      const events = await firstValueFrom(this.api.exportAuditEvents(this.appliedFilters()));
      const csv = await buildCsv(events);
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-events-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.error.set(extractAuditError(error));
    } finally {
      this.exporting.set(false);
    }
  }

  formatDate(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : this.dateFormatter.format(parsed).replace(/\s?г\.$/, '');
  }

  formatTime(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : this.timeFormatter.format(parsed);
  }

  trackEvent(index: number, event: AuditMonitoringEvent): string {
    return event.id || `${index}`;
  }
}

function normalizeFilters(filters: AuditMonitoringFilters): AuditMonitoringFilters {
  return {
    eventType: filters.eventType.trim(),
    actorQuery: filters.actorQuery.trim(),
    actorUserId: filters.actorUserId.trim(),
    targetId: filters.targetId.trim(),
    assessmentId: filters.assessmentId.trim(),
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
}

function areFiltersEqual(a: AuditMonitoringFilters, b: AuditMonitoringFilters): boolean {
  return (
    a.eventType === b.eventType &&
    a.actorQuery === b.actorQuery &&
    a.actorUserId === b.actorUserId &&
    a.targetId === b.targetId &&
    a.assessmentId === b.assessmentId &&
    a.dateFrom === b.dateFrom &&
    a.dateTo === b.dateTo
  );
}

function extractAuditError(error: unknown): string {
  if (!error) {
    return 'Не удалось загрузить события аудита.';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object') {
    const withMessage = error as { rawMessage?: unknown; message?: unknown };
    if (typeof withMessage.rawMessage === 'string' && withMessage.rawMessage.trim()) {
      return withMessage.rawMessage.trim();
    }
    if (typeof withMessage.message === 'string' && withMessage.message.trim()) {
      return withMessage.message.trim();
    }
  }

  return 'Не удалось загрузить события аудита.';
}

async function buildCsv(events: AuditMonitoringEvent[]): Promise<string> {
  const header = [
    'Дата',
    'Время',
    'Тип события',
    'Action title',
    'Action context',
    'Actor name',
    'Actor email',
    'Actor role',
    'Target type',
    'Target id',
    'Target title',
    'Target context',
    'IP',
    'User-Agent',
    'Before JSON',
    'After JSON',
  ];

  const rows = [serializeCsvRow(header)];

  for (let index = 0; index < events.length; index += 1) {
    if (index > 0 && index % CSV_BATCH_SIZE === 0) {
      await yieldToBrowser();
    }

    const event = events[index];
    const occurredAt = new Date(event.occurredAt);
    const date = Number.isNaN(occurredAt.getTime())
      ? event.occurredAt
      : occurredAt.toISOString().slice(0, 10);
    const time = Number.isNaN(occurredAt.getTime()) ? '' : occurredAt.toISOString().slice(11, 19);

    rows.push(
      serializeCsvRow([
        date,
        time,
        event.eventType,
        event.actionTitle,
        event.actionContext,
        event.actorName,
        event.actorEmail,
        event.actorRoleLabel,
        event.targetType,
        event.targetId,
        event.targetTitle,
        event.targetContext,
        event.ip,
        event.userAgent,
        event.beforeJson,
        event.afterJson,
      ]),
    );
  }

  return rows.join('\n');
}

function serializeCsvRow(row: Array<string | null | undefined>): string {
  return row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';');
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    const schedule = globalThis.requestAnimationFrame;
    if (typeof schedule === 'function') {
      schedule(() => resolve());
      return;
    }

    setTimeout(resolve, 0);
  });
}
