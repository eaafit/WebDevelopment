import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssessmentOrder } from './history/models';

@Component({
  selector: 'lib-assessment-detail-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assessment-detail-modal.html',
  styleUrls: ['./assessment-detail-modal.scss'],
})
export class AssessmentDetailModalComponent {
  @Input() order: AssessmentOrder | null = null;
  @Output() close = new EventEmitter<void>();

  closeModal(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      created: 'Создана',
      accepted: 'Принята',
      under_review: 'На рассмотрении',
      completed: 'Завершена',
      rejected: 'Отклонена',
    };
    return map[status] || status;
  }

  getObjectTypeLabel(type: string): string {
    const map: Record<string, string> = {
      apartment: 'Квартира',
      house: 'Дом',
      room: 'Комната',
      apartments: 'Апартаменты',
      landPlot: 'Земельный участок',
      commercialProperty: 'Коммерческая недвижимость',
    };
    return map[type] || type;
  }
}
