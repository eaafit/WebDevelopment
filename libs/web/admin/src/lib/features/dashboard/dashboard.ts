import { Component, computed, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AssessmentItem } from '../RequestAssessment/requests/requests';
import { ASSESSMENTS_STORAGE_KEY, DASHBOARD_SEED, QUICK_LINKS, QuickLink } from './dashboard.data';

type Status = AssessmentItem['status'];

interface Metric {
  key: 'total' | 'inProgress' | 'completed' | 'cancelled';
  label: string;
  value: number;
  hint: string;
}

@Component({
  selector: 'lib-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class AdminDashboard implements OnInit {
  private readonly assessments = signal<AssessmentItem[]>([]);
  private readonly updatedAt = signal<Date>(new Date());

  protected readonly quickLinks: QuickLink[] = QUICK_LINKS;

  protected readonly statusLabel: Record<Status, string> = {
    New: 'Новая',
    Verified: 'Подтверждена',
    InProgress: 'В работе',
    Completed: 'Завершена',
    Cancelled: 'Отменена',
  };

  protected readonly statusBadgeClass: Record<Status, string> = {
    New: 'admin-badge--neutral',
    Verified: 'admin-badge--info',
    InProgress: 'admin-badge--warning',
    Completed: 'admin-badge--success',
    Cancelled: 'admin-badge--critical',
  };

  protected readonly total = computed(() => this.assessments().length);
  protected readonly inProgressCount = computed(() => this.countByStatus('InProgress'));
  protected readonly completedCount = computed(() => this.countByStatus('Completed'));
  protected readonly cancelledCount = computed(() => this.countByStatus('Cancelled'));

  protected readonly metrics = computed<Metric[]>(() => [
    {
      key: 'total',
      label: 'Заявок всего',
      value: this.total(),
      hint: 'Все записи в системе на текущий момент.',
    },
    {
      key: 'inProgress',
      label: 'В работе',
      value: this.inProgressCount(),
      hint: 'Заявки, которые сейчас обрабатывает нотариус.',
    },
    {
      key: 'completed',
      label: 'Завершено',
      value: this.completedCount(),
      hint: 'Успешно закрытые оценки за всё время.',
    },
    {
      key: 'cancelled',
      label: 'Отменено',
      value: this.cancelledCount(),
      hint: 'Отменённые заявки — заявителем или администратором.',
    },
  ]);

  protected readonly latestFive = computed(() =>
    [...this.assessments()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
  );

  private readonly updatedAtFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  protected readonly updatedAtLabel = computed(() =>
    this.updatedAtFormatter.format(this.updatedAt()),
  );

  ngOnInit(): void {
    this.loadOrSeed();
  }

  protected refresh(): void {
    this.loadOrSeed();
    this.updatedAt.set(new Date());
  }

  private loadOrSeed(): void {
    const raw = localStorage.getItem(ASSESSMENTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ASSESSMENTS_STORAGE_KEY, JSON.stringify(DASHBOARD_SEED));
      this.assessments.set(DASHBOARD_SEED);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AssessmentItem[];
      this.assessments.set(Array.isArray(parsed) ? parsed : []);
    } catch {
      this.assessments.set([]);
    }
  }

  private countByStatus(status: Status): number {
    return this.assessments().filter((a) => a.status === status).length;
  }
}
