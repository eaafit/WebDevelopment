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

  // 5 этапов в правильном порядке
  stages = [
    { label: 'Создан', statusKey: 'pending' },
    { label: 'Проверен', statusKey: 'pending' }, // промежуточный
    { label: 'В работе', statusKey: 'in_progress' },
    { label: 'Оценён', statusKey: 'completed' }, // промежуточный
    { label: 'Завершён', statusKey: 'completed' },
  ];

  // Индекс текущего активного этапа (от 0 до 4)
  get activeStageIndex(): number {
    switch (this.currentStatus) {
      case 'pending':
        return 0; // Создан
      case 'in_progress':
        return 2; // В работе
      case 'completed':
        return 4; // Завершён
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
