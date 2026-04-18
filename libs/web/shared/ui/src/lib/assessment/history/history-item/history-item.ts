import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusTimelineComponent } from '../status-timeline/status-timeline';
import { AssessmentOrder } from '../models';

@Component({
  selector: 'lib-history-item',
  standalone: true,
  imports: [CommonModule, StatusTimelineComponent],
  templateUrl: './history-item.html',
  styleUrls: ['./history-item.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryItemComponent {
  @Input() order!: AssessmentOrder;
  @Input() role: 'applicant' | 'notary' = 'applicant';

  @Output() repeat = new EventEmitter<string>();
  @Output() view = new EventEmitter<string>();

  get statusBadgeClass(): string {
    switch (this.order.status) {
      case 'completed':
        return 'badge-success';
      case 'in_progress':
        return 'badge-pending';
      case 'failed':
        return 'badge-failed';
      default:
        return 'badge-pending';
    }
  }

  get statusLabel(): string {
    const map: Record<AssessmentOrder['status'], string> = {
      pending: 'Ожидает',
      in_progress: 'В работе',
      completed: 'Завершён',
      failed: 'Ошибка',
    };
    return map[this.order.status];
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  onRepeat(): void {
    this.repeat.emit(this.order.id);
  }

  onView(): void {
    this.view.emit(this.order.id);
  }
}
