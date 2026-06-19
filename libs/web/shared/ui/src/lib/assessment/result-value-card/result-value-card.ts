import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Assessment } from '../models/assessment.interface';

@Component({
  selector: 'lib-result-value-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './result-value-card.html',
  styleUrls: ['./result-value-card.scss']
})
export class ResultValueCardComponent {
  @Input() assessment?: Assessment;
  confidence = 85; // Mock value

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  getMinValue(): string {
    const min = (this.assessment?.finalEstimatedValue || 0) * 0.9;
    return this.formatCurrency(min);
  }

  getMaxValue(): string {
    const max = (this.assessment?.finalEstimatedValue || 0) * 1.1;
    return this.formatCurrency(max);
  }

  formatDate(date?: Date): string {
    if (!date) return '—';
    return new Intl.DateTimeFormat('ru-RU').format(new Date(date));
  }
}
