import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderStatus } from '../models';

@Component({
  selector: 'lib-status-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-timeline.html',
  styleUrls: ['./status-timeline.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusTimelineComponent {
  @Input({ required: true }) currentStatus!: OrderStatus;
  @Input() compact = false;

  stages = [
    { label: 'Создана', statusKey: 'created' },
    { label: 'Принята', statusKey: 'accepted' },
    { label: 'На рассмотрении', statusKey: 'under_review' },
    { label: 'Завершена', statusKey: 'completed' },
    { label: 'Отклонена', statusKey: 'rejected' },
  ];

  get activeStageIndex(): number {
    switch (this.currentStatus) {
      case 'created':
        return 0;
      case 'accepted':
        return 1;
      case 'under_review':
        return 2;
      case 'completed':
        return 3;
      case 'rejected':
        return 4;
      default:
        return -1;
    }
  }

  isCompleted(index: number): boolean {
    return index < this.activeStageIndex;
  }

  isCurrent(index: number): boolean {
    return index === this.activeStageIndex;
  }
}
