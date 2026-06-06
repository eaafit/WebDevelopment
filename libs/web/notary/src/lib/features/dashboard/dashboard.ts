import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

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
export class Dashboard {
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  private readonly updatedAt = signal<Date>(new Date());

  // Мок-данные для демонстрации
  private readonly assessments = signal<AssessmentItem[]>([
    { id: '1', applicantName: 'Иванов Иван', status: 'InProgress', address: 'г. Екатеринбург, ул. Малышева, 18', createdAt: '2024-06-01T10:00:00Z' },
    { id: '2', applicantName: 'Петрова Анна', status: 'New', address: 'г. Екатеринбург, ул. Бориса Ельцина, 3', createdAt: '2024-06-02T10:00:00Z' },
    { id: '3', applicantName: 'Сидоров Сергей', status: 'Completed', address: 'г. Екатеринбург, ул. Ленина, 25', createdAt: '2024-05-30T10:00:00Z' },
    { id: '4', applicantName: 'Кузнецова Ольга', status: 'Cancelled', address: 'г. Екатеринбург, ул. Мира, 10', createdAt: '2024-05-28T10:00:00Z' },
    { id: '5', applicantName: 'Морозов Дмитрий', status: 'Verified', address: 'г. Екатеринбург, ул. Тверитина, 5', createdAt: '2024-06-03T10:00:00Z' },
  ]);

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

  protected readonly total = computed(() => this.assessments().length);
  protected readonly inProgressCount = computed(() => this.countByStatus('InProgress'));
  protected readonly completedCount = computed(() => this.countByStatus('Completed'));
  protected readonly cancelledCount = computed(() => this.countByStatus('Cancelled'));

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
    this.updatedAt.set(new Date());
  }

  private countByStatus(status: Status): number {
    return this.assessments().filter(a => a.status === status).length;
  }
}