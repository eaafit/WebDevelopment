import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap, catchError, of } from 'rxjs';
import { AuditMonitoringApiService, type AuditMonitoringEvent } from '@notary-portal/ui';

type SearchMode = 'user' | 'assessment';

@Component({
  selector: 'lib-audit-by-entity',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './audit-by-entity.html',
  styleUrl: './audit-by-entity.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditByEntity {
  private readonly api = inject(AuditMonitoringApiService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchMode = signal<SearchMode>('user');
  readonly events = signal<AuditMonitoringEvent[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly userForm = this.fb.group({
    actorQuery: [''],
    actorUserId: [''],
  });

  readonly assessmentForm = this.fb.group({
    assessmentId: [''],
  });

  private readonly dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  constructor() {
    this.setupUserSearch();
    this.setupAssessmentSearch();
  }

  setSearchMode(mode: SearchMode): void {
    this.searchMode.set(mode);
    this.events.set([]);
    this.error.set(null);
    this.userForm.reset();
    this.assessmentForm.reset();
  }

  formatDate(isoString: string): string {
    return this.dateFormatter.format(new Date(isoString));
  }

  private setupUserSearch(): void {
    this.userForm.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap((values) => {
          const actorQuery = values.actorQuery?.trim() || '';
          const actorUserId = values.actorUserId?.trim() || '';

          if (!actorQuery && !actorUserId) {
            this.events.set([]);
            this.error.set(null);
            return of(null);
          }

          this.loading.set(true);
          this.error.set(null);

          return this.api
            .getAuditEvents({
              page: 1,
              limit: 50,
              eventType: '',
              actorQuery,
              actorUserId,
              targetId: '',
              assessmentId: '',
              dateFrom: '',
              dateTo: '',
            })
            .pipe(
              catchError((err) => {
                this.error.set('Ошибка загрузки событий');
                console.error('Failed to load audit events:', err);
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result) {
          this.events.set(result.events);
        }
      });
  }

  private setupAssessmentSearch(): void {
    this.assessmentForm.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap((values) => {
          const assessmentId = values.assessmentId?.trim() || '';

          if (!assessmentId) {
            this.events.set([]);
            this.error.set(null);
            return of(null);
          }

          this.loading.set(true);
          this.error.set(null);

          return this.api
            .getAuditEvents({
              page: 1,
              limit: 50,
              eventType: '',
              actorQuery: '',
              actorUserId: '',
              targetId: '',
              assessmentId,
              dateFrom: '',
              dateTo: '',
            })
            .pipe(
              catchError((err) => {
                this.error.set('Ошибка загрузки событий');
                console.error('Failed to load audit events:', err);
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result) {
          this.events.set(result.events);
        }
      });
  }
}
