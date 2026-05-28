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
      case 'accepted':
      case 'under_review':
        return 'badge-pending';
      case 'rejected':
        return 'badge-failed';
      default:
        return 'badge-pending';
    }
  }

  get statusLabel(): string {
    const map: Record<AssessmentOrder['status'], string> = {
      created: 'Создана',
      accepted: 'Принята',
      under_review: 'На рассмотрении',
      completed: 'Завершена',
      rejected: 'Отклонена',
    };
    return map[this.order.status];
  }

  formatDate(date: any): string {
    if (!date) return '—';

    let dateObj: Date;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'object' && 'seconds' in date) {
      // Timestamp из protobuf
      dateObj = new Date(Number(date.seconds) * 1000);
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      return '—';
    }

    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(dateObj);
  }

  onRepeat(): void {
    this.repeat.emit(this.order.id);
  }

  onView(): void {
    this.view.emit(this.order.id);
  }
}
