import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, of, switchMap } from 'rxjs';
import { AuditMonitoringApiService, type AuditMonitoringEvent } from '@notary-portal/ui';

/**
 * Лента истории событий заявки (Лаба №7, audit).
 *
 * Переиспользует готовый фронт-фасад `AuditMonitoringApiService`
 * (`@notary-portal/ui`) и читает существующий Audit RPC по `targetId`
 * заявки. Никакой записи в audit и никаких backend-изменений — только
 * чтение. События жизненного цикла пишутся бэкендом в
 * `assessment.service.ts` (зона Бурцевой+eaafit) с `targetId == assessment.id`.
 */
interface TimelineEventMeta {
  icon: string;
  label: string;
  colorKey: string;
}

const EVENT_META: Record<string, TimelineEventMeta> = {
  'assessment.created': { icon: '🆕', label: 'Создана', colorKey: 'created' },
  'assessment.updated': { icon: '✏️', label: 'Обновлена', colorKey: 'updated' },
  'assessment.assigned_to_notary': {
    icon: '👨‍⚖️',
    label: 'Назначен нотариус',
    colorKey: 'assigned',
  },
  'assessment.status_in_progress': { icon: '🔄', label: 'В работе', colorKey: 'progress' },
  'assessment.completed': { icon: '✔️', label: 'Завершена', colorKey: 'completed' },
  'assessment.cancelled': { icon: '❌', label: 'Отменена', colorKey: 'cancelled' },
};

const DEFAULT_META: TimelineEventMeta = { icon: '•', label: 'Событие', colorKey: 'default' };

const AUDIT_PAGE_LIMIT = 50;

@Component({
  selector: 'lib-audit-timeline',
  imports: [CommonModule],
  templateUrl: './audit-timeline.html',
  styleUrl: './audit-timeline.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditTimelineComponent {
  /** ID открытой заявки. Равен `targetId` аудит-события (`assessment.id`). */
  readonly assessmentId = input.required<string>();

  private readonly api = inject(AuditMonitoringApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly events = signal<AuditMonitoringEvent[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isEmpty = computed(() => !this.loading() && !this.error() && this.events().length === 0);

  private readonly dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  constructor() {
    toObservable(this.assessmentId)
      .pipe(
        distinctUntilChanged(),
        switchMap((assessmentId) => {
          const id = assessmentId?.trim() || '';
          if (!id) {
            this.events.set([]);
            this.error.set(null);
            return of(null);
          }

          this.loading.set(true);
          this.error.set(null);

          return this.api
            .getAuditEvents({
              page: 1,
              limit: AUDIT_PAGE_LIMIT,
              eventType: '',
              actorQuery: '',
              actorUserId: '',
              targetId: id,
              dateFrom: '',
              dateTo: '',
            })
            .pipe(
              catchError((err) => {
                this.error.set('Не удалось загрузить историю заявки');
                console.error('Failed to load assessment audit events:', err);
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result) {
          this.events.set(sortChronologically(result.events));
        }
      });
  }

  iconFor(eventType: string): string {
    return (EVENT_META[eventType] ?? DEFAULT_META).icon;
  }

  colorKey(eventType: string): string {
    return (EVENT_META[eventType] ?? DEFAULT_META).colorKey;
  }

  labelFor(event: AuditMonitoringEvent): string {
    return event.actionTitle?.trim() || EVENT_META[event.eventType]?.label || DEFAULT_META.label;
  }

  actorFor(event: AuditMonitoringEvent): string {
    return [event.actorName?.trim(), event.actorRoleLabel?.trim()].filter(Boolean).join(' · ');
  }

  formatDate(isoString: string): string {
    if (!isoString) return '—';
    return this.dateFormatter.format(new Date(isoString));
  }
}

function sortChronologically(events: readonly AuditMonitoringEvent[]): AuditMonitoringEvent[] {
  return [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}
