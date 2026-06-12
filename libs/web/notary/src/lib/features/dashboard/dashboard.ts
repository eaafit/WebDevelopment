import { Component, computed, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardUpdateService } from '../../services/dashboard-update.service';
import { NotaryAssessmentApiService } from '../../services/assessment-api.service';
import { UserApiService } from '../../services/user.service';
import { Subscription } from 'rxjs';

type Status = 'New' | 'Verified' | 'InProgress' | 'Completed' | 'Cancelled';

interface AssessmentItem {
  id: string;
  applicantName: string;
  status: Status;
  address: string;
  createdAt: string;
}

@Component({
  selector: 'lib-notary-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  private dashboardUpdateService = inject(DashboardUpdateService);
  private assessmentApi = inject(NotaryAssessmentApiService);
  private userApi = inject(UserApiService);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  private readonly updatedAt = signal<Date>(new Date());
  private readonly assessments = signal<AssessmentItem[]>([]);

  private metricsSubscription?: Subscription;

  ngOnInit(): void {
    this.metricsSubscription = this.dashboardUpdateService.metrics$.subscribe(metrics => {
      if (metrics.total > 0) {
        this.totalCount.set(metrics.total);
        this.inProgressCount.set(metrics.inProgress);
        this.completedCount.set(metrics.completed);
        this.cancelledCount.set(metrics.cancelled);
      }
    });
    this.loadAssessments();
  }

  ngOnDestroy(): void {
    this.metricsSubscription?.unsubscribe();
  }

  private async loadAssessments(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      await this.userApi.loadUsers().catch(() => undefined);
      const data = await this.assessmentApi.listAssessments();
      const typedData: AssessmentItem[] = data.map(item => ({
        id: item.id,
        applicantName: this.userApi.getUserName(item.userId),
        status: item.status as Status,
        address: item.address,
        createdAt: item.createdAt,
      }));
      this.assessments.set(typedData);
      this.updatedAt.set(new Date());
      this.updateMetricsFromData(typedData);
    } catch (error) {
      this.loadError.set('Не удалось загрузить заявки');
      console.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  private updateMetricsFromData(data: AssessmentItem[]): void {
    this.totalCount.set(data.length);
    this.inProgressCount.set(data.filter(a => a.status === 'InProgress').length);
    this.completedCount.set(data.filter(a => a.status === 'Completed').length);
    this.cancelledCount.set(data.filter(a => a.status === 'Cancelled').length);
  }

  // Метрики
  private totalCount = signal(0);
  private inProgressCount = signal(0);
  private completedCount = signal(0);
  private cancelledCount = signal(0);

  protected readonly total = computed(() => this.totalCount());
  protected readonly inProgress = computed(() => this.inProgressCount());
  protected readonly completed = computed(() => this.completedCount());
  protected readonly cancelled = computed(() => this.cancelledCount());

  protected readonly metrics = computed(() => [
    { key: 'total', label: 'Заявок всего', value: this.total(), hint: 'Все ваши заявки на текущий момент.' },
    { key: 'inProgress', label: 'В работе', value: this.inProgress(), hint: 'Заявки, которые вы сейчас обрабатываете.' },
    { key: 'completed', label: 'Завершено', value: this.completed(), hint: 'Успешно закрытые вами оценки.' },
    { key: 'cancelled', label: 'Отменено', value: this.cancelled(), hint: 'Отменённые заявки.' },
  ]);

  protected readonly latestFive = computed(() =>
    [...this.assessments()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
  );

  protected readonly statusLabel: Record<Status, string> = {
    New: 'Новая',
    Verified: 'Подтверждена',
    InProgress: 'В работе',
    Completed: 'Завершена',
    Cancelled: 'Отменена',
  };

  protected readonly statusBadgeClass: Record<Status, string> = {
    New: 'notary-badge--neutral',
    Verified: 'notary-badge--info',
    InProgress: 'notary-badge--warning',
    Completed: 'notary-badge--success',
    Cancelled: 'notary-badge--critical',
  };

  protected readonly quickLinks = [
    { route: 'orders', icon: '📄', eyebrow: 'Заказы', title: 'Управление заказами', description: 'Полный список заявок, смена статусов, фильтры и поиск.' },
    { route: 'subscription', icon: '👑', eyebrow: 'Подписка', title: 'Тарифы и оплата', description: 'Выбор тарифа, оплата подписки, история платежей.' },
    { route: 'transactions', icon: '💳', eyebrow: 'Финансы', title: 'Транзакции', description: 'История платежей по вашим заявкам.' },
    { route: 'notifications', icon: '🔔', eyebrow: 'Уведомления', title: 'Уведомления', description: 'История уведомлений и настройки.' },
  ];

  protected readonly updatedAtLabel = computed(() => {
    const d = this.updatedAt();
    return `${d.toLocaleDateString('ru-RU')}, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  });

  refresh(): void {
    this.loadAssessments();
  }
}