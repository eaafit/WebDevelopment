import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AssessmentResultsApiService,
  type AssessmentResultItem,
} from '../assessment-results-api.service';
import { formatRubles } from '../assessment-report.models';
import { EstimationFormSessionService } from '../../../estimation-form/estimation-form-session.service';

@Component({
  selector: 'lib-assessment-results-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './results-list.html',
  styleUrl: './results-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssessmentResultsComponent {
  readonly assessments = signal<AssessmentResultItem[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  private readonly api = inject(AssessmentResultsApiService);
  private readonly sessionService = inject(EstimationFormSessionService);

  constructor() {
    void this.loadResults();
  }

  formatValue(value: number | null): string {
    return value === null ? '—' : formatRubles(value);
  }

  formatDate(isoDate: string | null): string {
    if (!isoDate) {
      return '—';
    }

    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(isoDate));
  }

  private async loadResults(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(null);

    try {
      const userId = await this.sessionService.ensureUserId();
      const items = await this.api.listCompletedAssessments(userId);
      this.assessments.set(items);
    } catch {
      this.loadError.set('Не удалось загрузить результаты оценки. Попробуйте обновить страницу.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
