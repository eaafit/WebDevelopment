import { Component, computed, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardUpdateService } from '../../services/dashboard-update.service';
import { NotaryAssessmentApiService } from '../../services/assessment-api.service';
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

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  private readonly updatedAt = signal<Date>(new Date());
  private readonly assessments = signal<AssessmentItem[]>([]);

  private metricsSubscription?: Subscription;
  private totalAssessments = signal(0);
  private inProgressAssessments = signal(0);
  private completedAssessments = signal(0);
  private cancelledAssessments = signal(0);

  ngOnInit(): void {
    this.metricsSubscription = this.dashboardUpdateService.metrics$.subscribe(metrics => {
      this.totalAssessments.set(metrics.total);
      this.inProgressAssessments.set(metrics.inProgress);
      this.completedAssessments.set(metrics.completed);
      this.cancelledAssessments.set(metrics.cancelled);
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
      const data = await this.assessmentApi.getAssessments();
      const typedData: AssessmentItem[] = data.map(item => ({
        ...item,
        status: item.status as Status
      }));
      this.assessments.set(typedData);
      this.updatedAt.set(new Date());
    } catch (error) {
      this.loadError.set('Не удалось загрузить заявки');
      console.error(error);
    } finally {
      this.loading.set(false);
    }
  }

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

  protected readonly total = computed(() => this.totalAssessments());
  protected readonly inProgressCount = computed(() => this.inProgressAssessments());
  protected readonly completedCount = computed(() => this.completedAssessments());
  protected readonly cancelledCount = computed(() => this.cancelledAssessments());

  protected readonly metrics = computed(() => [
    { key: 'total', label: 'Заявок всего', value: this.total(), hint: 'Все ваши заявки на текущий момент.' },
    { key: 'inProgress', label: 'В работе', value: this.inProgressCount(), hint: 'Заявки, которые вы сейчас обрабатываете.' },
    { key: 'completed', label: 'Завершено', value: this.completedCount(), hint: 'Успешно закрытые вами оценки.' },
    { key: 'cancelled', label: 'Отменено', value: this.cancelledCount(), hint: 'Отменённые заявки.' },
  ]);

  protected readonly latestFive = computed(() =>
    [...this.assessments()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
  );

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
