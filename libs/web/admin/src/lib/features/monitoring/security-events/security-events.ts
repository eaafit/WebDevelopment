import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, Observable } from 'rxjs';
import { concatMap, map } from 'rxjs/operators';
import {
  AuditMonitoringApiService,
  type AuditMonitoringEvent,
  type AuditMonitoringPageResult,
} from '@notary-portal/ui';

type RiskLevel = 'warning' | 'error';

interface SecurityEvent extends AuditMonitoringEvent {
  riskLevel: RiskLevel;
}

const SECURITY_EVENT_TYPES = [
  'user.login_failed',
  'user.blocked',
  'token.revoked',
  'permission.denied',
] as const;

const RISK_LEVELS: Record<string, RiskLevel> = {
  'user.login_failed': 'warning',
  'user.blocked': 'error',
  'token.revoked': 'error',
  'permission.denied': 'error',
};

@Component({
  selector: 'lib-security-events',
  imports: [CommonModule],
  templateUrl: './security-events.html',
  styleUrl: './security-events.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityEvents {
  private readonly api = inject(AuditMonitoringApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly events = signal<SecurityEvent[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly exporting = signal(false);

  private readonly dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  readonly eventsLast24h = computed(() => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    return this.events().filter((event) => {
      const eventTime = new Date(event.occurredAt).getTime();
      return eventTime >= oneDayAgo;
    }).length;
  });

  constructor() {
    this.loadSecurityEvents();
  }

  formatDate(isoString: string): string {
    return this.dateFormatter.format(new Date(isoString));
  }

  getRiskLevelClass(level: RiskLevel): string {
    return `risk-${level}`;
  }

  getRiskLevelLabel(level: RiskLevel): string {
    return level === 'error' ? 'Высокий' : 'Средний';
  }

  exportToCsv(): void {
    this.exporting.set(true);
    this.error.set(null);

    const requests = SECURITY_EVENT_TYPES.map((eventType) =>
      this.api.exportAuditEvents({
        eventType,
        actorQuery: '',
        actorUserId: '',
        targetId: '',
        dateFrom: '',
        dateTo: '',
      }),
    );

    forkJoin(requests)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          const allEvents = results.flat();
          const securityEvents = allEvents.map((event) => this.toSecurityEvent(event));

          this.downloadCsv(securityEvents);
          this.exporting.set(false);
        },
        error: () => {
          this.error.set('Ошибка экспорта событий');
          this.exporting.set(false);
        },
      });
  }

  private loadSecurityEvents(): void {
    this.loading.set(true);
    this.error.set(null);

    const requests = SECURITY_EVENT_TYPES.map((eventType) =>
      this.loadAllPagesForEventType(eventType),
    );

    forkJoin(requests)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          const allEvents = results.flat();
          const securityEvents = allEvents
            .map((event) => this.toSecurityEvent(event))
            .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

          this.events.set(securityEvents);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Ошибка загрузки событий безопасности');
          this.loading.set(false);
        },
      });
  }

  private loadAllPagesForEventType(eventType: string): Observable<AuditMonitoringEvent[]> {
    const limit = 100;

    return this.api
      .getAuditEvents({
        page: 1,
        limit,
        eventType,
        actorQuery: '',
        actorUserId: '',
        targetId: '',
        dateFrom: '',
        dateTo: '',
      })
      .pipe(
        concatMap((firstPage: AuditMonitoringPageResult) => {
          const totalPages = firstPage.meta?.totalPages || 1;
          const allEvents = [...firstPage.events];

          if (totalPages <= 1) {
            return [allEvents];
          }

          const remainingPages: Observable<AuditMonitoringPageResult>[] = [];
          for (let page = 2; page <= totalPages; page++) {
            remainingPages.push(
              this.api.getAuditEvents({
                page,
                limit,
                eventType,
                actorQuery: '',
                actorUserId: '',
                targetId: '',
                dateFrom: '',
                dateTo: '',
              }),
            );
          }

          return forkJoin(remainingPages).pipe(
            map((pages) => {
              pages.forEach((p) => allEvents.push(...p.events));
              return allEvents;
            }),
          );
        }),
      );
  }

  private toSecurityEvent(event: AuditMonitoringEvent): SecurityEvent {
    return {
      ...event,
      riskLevel: RISK_LEVELS[event.eventType] || 'warning',
    };
  }

  private downloadCsv(events: SecurityEvent[]): void {
    const headers = [
      'Дата/Время',
      'Тип события',
      'Пользователь',
      'Email',
      'IP',
      'User-Agent',
      'Объект',
      'Уровень риска',
    ];

    const rows = events.map((event) => [
      this.formatDate(event.occurredAt),
      event.eventType,
      event.actorName || '',
      event.actorEmail || '',
      event.ip || '',
      event.userAgent || '',
      event.targetTitle || '',
      this.getRiskLevelLabel(event.riskLevel),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['﻿' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    let url = '';

    try {
      url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `security-events-${new Date().toISOString().split('T')[0]}.csv`,
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      if (url) {
        URL.revokeObjectURL(url);
      }
    }
  }
}
