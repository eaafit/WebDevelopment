import { Component, computed, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardUpdateService } from '../../services/dashboard-update.service';
import { Subscription } from 'rxjs';

// Импортируем мок-данные из assessment.ts
import { MOCK_ASSESSMENTS } from '../assessment/assessment';
import type { AssessmentItem } from '../assessment/assessment';

type Status = AssessmentItem['status'];

@Component({
  selector: 'lib-notary-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  private dashboardUpdateService = inject(DashboardUpdateService);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  private readonly updatedAt = signal<Date>(new Date());
  private readonly assessments = signal<AssessmentItem[]>(MOCK_ASSESSMENTS);

  private metricsSubscription?: Subscription;

  // Метрики из мок-данных
  private totalCount = signal(this.assessments().length);
  private inProgressCount = signal(this.assessments().filter(a => a.status === 'InProgress').length);
  private completedCount = signal(this.assessments().filter(a => a.status === 'Completed').length);
  private cancelledCount = signal(this.assessments().filter(a => a.status === 'Cancelled').length);

  ngOnInit(): void {
    this.metricsSubscription = this.dashboardUpdateService.metrics$.subscribe(metrics => {
      if (metrics.total > 0) {
        this.totalCount.set(metrics.total);
        this.inProgressCount.set(metrics.inProgress);
        this.completedCount.set(metrics.completed);
        this.cancelledCount.set(metrics.cancelled);
      }
    });
  }

  ngOnDestroy(): void {
    this.metricsSubscription?.unsubscribe();
  }

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
    this.updatedAt.set(new Date());
    this.totalCount.set(this.assessments().length);
    this.inProgressCount.set(this.assessments().filter(a => a.status === 'InProgress').length);
    this.completedCount.set(this.assessments().filter(a => a.status === 'Completed').length);
    this.cancelledCount.set(this.assessments().filter(a => a.status === 'Cancelled').length);
  }
}
