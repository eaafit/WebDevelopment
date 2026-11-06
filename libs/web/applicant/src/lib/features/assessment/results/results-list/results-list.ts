import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EstimationFormSessionService } from '../../../estimation-form/estimation-form-session.service';
import { AssessmentResultsApiService } from '../assessment-results-api.service';
import { formatDate, formatRub, type AssessmentResultModel } from '../assessment-results.models';

@Component({
  selector: 'lib-assessment-results',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './results-list.html',
  styleUrl: './results-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssessmentResultsComponent {
  readonly results = signal<AssessmentResultModel[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly formatRub = formatRub;
  readonly formatDate = formatDate;

  private readonly resultsApi = inject(AssessmentResultsApiService);
  private readonly sessionService = inject(EstimationFormSessionService);

  constructor() {
    void this.loadResults();
  }

  async loadResults(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    try {
      const userId = await this.sessionService.ensureUserId();
      this.results.set(await this.resultsApi.listResults(userId));
    } catch (error) {
      console.error('[ApplicantAssessmentResults] list.load:error', error);
      this.loadError.set('Не удалось загрузить результаты оценки. Попробуйте обновить страницу.');
    } finally {
      this.loading.set(false);
    }
  }
}
