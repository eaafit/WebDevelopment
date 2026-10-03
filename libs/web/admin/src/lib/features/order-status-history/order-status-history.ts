import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';

export type ApplicationStatusKey =
  | 'created'
  | 'taken_by_notary'
  | 'moderation_failed'
  | 'needs_revision'
  | 'accepted_by_notary'
  | 'assigned_to_appraiser'
  | 'rejected_by_appraiser'
  | 'taken_by_appraiser'
  | 'appraisal_done'
  | 'completed';

export interface OrderStatusHistoryRow {
  id: string;
  orderId: string;
  fromStatus: ApplicationStatusKey | null;
  toStatus: ApplicationStatusKey;
  changedAt: string;
  actor: string;
  notifyApplicant: boolean;
  notifyNotary: boolean;
  notes: string;
}

const STATUS_LABELS: Record<ApplicationStatusKey, string> = {
  created: 'Заявка создана',
  taken_by_notary: 'Взята нотариусом в работу',
  moderation_failed: 'Не прошла модерацию',
  needs_revision: 'Требует доработки',
  accepted_by_notary: 'Принята нотариусом',
  assigned_to_appraiser: 'Назначена на оценщика',
  rejected_by_appraiser: 'Отклонена оценщиком',
  taken_by_appraiser: 'Принята оценщиком в работу',
  appraisal_done: 'Экспертиза проведена',
  completed: 'Заявка завершена',
};

/** Демо-история по диаграмме состояний (заявка #A-1244 + ветка отклонения #A-1190) */
const MOCK_ROWS: OrderStatusHistoryRow[] = [
  {
    id: 'h-1',
    orderId: 'A-1244',
    fromStatus: null,
    toStatus: 'created',
    changedAt: '2026-03-01T09:12:00+03:00',
    actor: 'Заявитель',
    notifyApplicant: false,
    notifyNotary: true,
    notes: 'Новая заявка; уведомление нотариусу о создании.',
  },
  {
    id: 'h-2',
    orderId: 'A-1244',
    fromStatus: 'created',
    toStatus: 'taken_by_notary',
    changedAt: '2026-03-01T10:05:00+03:00',
    actor: 'Нотариус Смирнова А.В.',
    notifyApplicant: true,
    notifyNotary: false,
    notes: 'Взята в работу; заявителю — «принята на модерацию».',
  },
  {
    id: 'h-3',
    orderId: 'A-1244',
    fromStatus: 'taken_by_notary',
    toStatus: 'needs_revision',
    changedAt: '2026-03-02T14:30:00+03:00',
    actor: 'Нотариус Смирнова А.В.',
    notifyApplicant: true,
    notifyNotary: false,
    notes: 'Требуется доработка документов.',
  },
  {
    id: 'h-4',
    orderId: 'A-1244',
    fromStatus: 'needs_revision',
    toStatus: 'taken_by_notary',
    changedAt: '2026-03-04T11:00:00+03:00',
    actor: 'Система',
    notifyApplicant: false,
    notifyNotary: true,
    notes: 'Заявитель загрузил файлы; снова в работе у нотариуса.',
  },
  {
    id: 'h-5',
    orderId: 'A-1244',
    fromStatus: 'taken_by_notary',
    toStatus: 'accepted_by_notary',
    changedAt: '2026-03-05T16:45:00+03:00',
    actor: 'Нотариус Смирнова А.В.',
    notifyApplicant: true,
    notifyNotary: false,
    notes: 'Модерация пройдена; заявка принята.',
  },
  {
    id: 'h-6',
    orderId: 'A-1244',
    fromStatus: 'accepted_by_notary',
    toStatus: 'assigned_to_appraiser',
    changedAt: '2026-03-06T09:00:00+03:00',
    actor: 'Администратор',
    notifyApplicant: true,
    notifyNotary: false,
    notes: 'Назначен оценщик ООО «Оценка-Про».',
  },
  {
    id: 'h-7',
    orderId: 'A-1244',
    fromStatus: 'assigned_to_appraiser',
    toStatus: 'taken_by_appraiser',
    changedAt: '2026-03-07T10:20:00+03:00',
    actor: 'Оценщик Иванов П.С.',
    notifyApplicant: true,
    notifyNotary: false,
    notes: 'Оценщик взял заявку в работу.',
  },
  {
    id: 'h-8',
    orderId: 'A-1244',
    fromStatus: 'taken_by_appraiser',
    toStatus: 'appraisal_done',
    changedAt: '2026-03-09T15:00:00+03:00',
    actor: 'Оценщик Иванов П.С.',
    notifyApplicant: false,
    notifyNotary: true,
    notes: 'Экспертиза завершена; уведомление нотариусу.',
  },
  {
    id: 'h-9',
    orderId: 'A-1244',
    fromStatus: 'appraisal_done',
    toStatus: 'completed',
    changedAt: '2026-03-10T12:00:00+03:00',
    actor: 'Нотариус Смирнова А.В.',
    notifyApplicant: true,
    notifyNotary: false,
    notes: 'Заявка закрыта; заявителю — итог и документы.',
  },
  {
    id: 'h-10',
    orderId: 'A-1190',
    fromStatus: 'taken_by_notary',
    toStatus: 'moderation_failed',
    changedAt: '2026-03-08T09:15:00+03:00',
    actor: 'Нотариус Петров П.П.',
    notifyApplicant: true,
    notifyNotary: false,
    notes: 'Отказ в модерации; финальный статус по ветке диаграммы.',
  },
  {
    id: 'h-11',
    orderId: 'A-1188',
    fromStatus: 'assigned_to_appraiser',
    toStatus: 'rejected_by_appraiser',
    changedAt: '2026-03-03T17:00:00+03:00',
    actor: 'Оценщик Сидоров В.К.',
    notifyApplicant: true,
    notifyNotary: true,
    notes: 'Оценщик отклонил объект; уведомления обеим сторонам.',
  },
];

type SortDir = 'asc' | 'desc';

@Component({
  selector: 'lib-order-status-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-status-history.html',
  styleUrl: './order-status-history.scss',
})
export class OrderStatusHistory {
  protected readonly rows = signal<OrderStatusHistoryRow[]>([...MOCK_ROWS]);

  protected readonly searchOrderId = signal('');
  protected readonly filterToStatus = signal<ApplicationStatusKey | 'all'>('all');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');
  protected readonly sortDir = signal<SortDir>('desc');

  protected readonly statusOptions: ApplicationStatusKey[] = [
    'created',
    'taken_by_notary',
    'moderation_failed',
    'needs_revision',
    'accepted_by_notary',
    'assigned_to_appraiser',
    'rejected_by_appraiser',
    'taken_by_appraiser',
    'appraisal_done',
    'completed',
  ];

  protected readonly filteredSorted = computed(() => {
    const q = this.searchOrderId().trim().toLowerCase();
    const toSt = this.filterToStatus();
    const from = this.dateFrom();
    const to = this.dateTo();
    const dir = this.sortDir();

    let list = this.rows().filter((r) => {
      if (q && !r.orderId.toLowerCase().includes(q)) return false;
      if (toSt !== 'all' && r.toStatus !== toSt) return false;
      const d = r.changedAt.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      const cmp = a.changedAt.localeCompare(b.changedAt);
      return dir === 'asc' ? cmp : -cmp;
    });

    return list;
  });

  protected statusLabel(key: ApplicationStatusKey | null): string {
    if (key === null) return '—';
    return STATUS_LABELS[key];
  }

  protected setSearch(value: string): void {
    this.searchOrderId.set(value);
  }

  protected setFilterToStatus(value: string): void {
    this.filterToStatus.set(value as ApplicationStatusKey | 'all');
  }

  protected setDateFrom(value: string): void {
    this.dateFrom.set(value);
  }

  protected setDateTo(value: string): void {
    this.dateTo.set(value);
  }

  protected toggleSort(): void {
    this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
  }

  protected deleteRow(id: string): void {
    if (!confirm('Удалить эту запись из истории статусов? (демо, только в интерфейсе)')) {
      return;
    }
    this.rows.update((list) => list.filter((r) => r.id !== id));
  }

  protected resetFilters(): void {
    this.searchOrderId.set('');
    this.filterToStatus.set('all');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.sortDir.set('desc');
  }

  protected restoreDemo(): void {
    this.rows.set([...MOCK_ROWS]);
    this.resetFilters();
  }
}
