import { Component, computed, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AdminAssessmentApiService,
  type AdminAssessmentRow,
} from '../RequestAssessment/services/assessment-api.service';
import { AdminUserApiService } from '../RequestAssessment/services/user-api.service';
import { AssessmentItem } from '../RequestAssessment/requests/requests';
import { QUICK_LINKS, QuickLink } from './dashboard.data';

const DASHBOARD_PAGE_LIMIT = 200;

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
  private readonly assessmentApi = inject(AdminAssessmentApiService);
  private readonly userApi = inject(AdminUserApiService);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly userLookupWarning = signal<string | null>(null);
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
    void this.initialLoad();
  }

  refresh(): void {
    void this.initialLoad();
  }

  private async initialLoad(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    this.userLookupWarning.set(null);
    try {
      // userApi.loadUsers() обязателен до маппинга, чтобы applicantName
      // в виджете «Последние заявки» был именем, а не UUID-стабом.
      await this.loadUsersForDisplay();
      await this.loadAssessments();
      this.updatedAt.set(new Date());
    } catch (error) {
      this.loadError.set((error as Error).message || 'Не удалось загрузить данные дашборда');
      this.assessments.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadAssessments(): Promise<void> {
    const page = await this.assessmentApi.listAssessments({
      page: 1,
      limit: DASHBOARD_PAGE_LIMIT,
    });
    this.assessments.set(page.items.map((row) => this.toAssessmentItem(row)));
  }

  private async loadUsersForDisplay(): Promise<void> {
    try {
      await this.userApi.loadUsers();
    } catch (error) {
      this.userLookupWarning.set(
        (error as Error).message ||
          'Applicant names are temporarily unavailable',
      );
    }
  }

  private toAssessmentItem(row: AdminAssessmentRow): AssessmentItem {
    return {
      id: row.id,
      userId: row.userId,
      applicantName: this.userApi.getUserName(row.userId),
      status: row.status,
      address: row.address,
      description: row.description,
      estimatedValue: row.estimatedValue,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      // notaryId намеренно не подмешивается — дашборд его не показывает.
      // Workaround localStorage['admin_notary_assignments'] остаётся в requests.ts.
    };
  }

  private countByStatus(status: Status): number {
    return this.assessments().filter((a) => a.status === status).length;
  }
}
