import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusHistoryEntry } from '../models';

@Component({
  selector: 'lib-status-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-timeline.html',
  styleUrls: ['./status-timeline.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusTimelineComponent {
  @Input({ required: true }) history!: StatusHistoryEntry[];

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  getStatusName(status: string): string {
    const map: Record<string, string> = {
      pending: 'Заказ создан',
      in_progress: 'В работе',
      completed: 'Завершён',
      failed: 'Отказ',
    };
    return map[status] || status;
  }
}
