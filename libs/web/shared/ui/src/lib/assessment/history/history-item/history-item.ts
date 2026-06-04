import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusTimelineComponent } from '../status-timeline/status-timeline';
import { AssessmentOrder } from '../models';
import { OrderApiService } from '../../order-api.service';
import { RouterModule } from '@angular/router';
import { WebLoggerService } from '@notary-portal/ui';

@Component({
  selector: 'lib-history-item',
  standalone: true,
  imports: [CommonModule, StatusTimelineComponent, RouterModule],
  templateUrl: './history-item.html',
  styleUrls: ['./history-item.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryItemComponent {
  @Input() order!: AssessmentOrder;
  @Input() role: 'applicant' | 'notary' = 'applicant';
  @Input() currentUserId: string = '';
  @Output() repeat = new EventEmitter<string>();
  @Output() view = new EventEmitter<string>();
  @Output() orderTaken = new EventEmitter<string>();

  private orderApi = inject(OrderApiService);
  private logger = inject(WebLoggerService);

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

  // Геттер: может ли текущий нотариус взять этот заказ
  get canTakeOrder(): boolean {
    return this.role === 'notary' && !this.order.notaryId && this.order.status === 'created';
  }

  // Геттер: этот заказ уже взят текущим нотариусом
  get isTakenByCurrentNotary(): boolean {
    return this.role === 'notary' && this.order.notaryId === this.currentUserId;
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

  async onTakeWork(): Promise<void> {
    this.logger.info('order.item.take_work_started', { orderId: this.order.id });
    try {
      await this.orderApi.takeOrder(this.order.id, this.currentUserId);
      this.logger.info('order.item.take_work_succeeded', { orderId: this.order.id });
      this.orderTaken.emit(this.order.id);
    } catch (err) {
      this.logger.error('order.item.take_work_failed', { orderId: this.order.id, error: err });
    }
  }
}