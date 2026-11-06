import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AssessmentResultsApiService, buildMockBreakdown } from '../assessment-results-api.service';
import {
  formatDate,
  formatRub,
  type AssessmentReport,
  type AssessmentResultModel,
} from '../assessment-results.models';

const ASSESSMENT_ID_ROUTE_PARAM = 'assessmentId';

@Component({
  selector: 'lib-assessment-result-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './result-detail.html',
  styleUrl: './result-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssessmentResultDetailComponent {
  readonly result = signal<AssessmentResultModel | null>(null);
  readonly reports = signal<AssessmentReport[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly breakdown = computed(() =>
    buildMockBreakdown(this.result()?.finalEstimatedValue ?? null),
  );

  readonly formatRub = formatRub;
  readonly formatDate = formatDate;

  private readonly route = inject(ActivatedRoute);
  private readonly resultsApi = inject(AssessmentResultsApiService);

  constructor() {
    void this.loadResult();
  }

  downloadReport(report: AssessmentReport): void {
    if (report.status !== 'Signed' || !report.fileUrl) {
      return;
    }

    window.open(report.fileUrl, '_blank', 'noopener');
  }

  private async loadResult(): Promise<void> {
    const assessmentId = this.route.snapshot.paramMap.get(ASSESSMENT_ID_ROUTE_PARAM)?.trim() ?? '';
    if (!assessmentId) {
      this.loadError.set('Не указан идентификатор оценки.');
      this.loading.set(false);
      return;
    }

    try {
      const [result, reports] = await Promise.all([
        this.resultsApi.getResult(assessmentId),
        this.resultsApi.listReports(assessmentId),
      ]);
      if (!result) {
        this.loadError.set('Оценка не найдена или ещё не завершена.');
        return;
      }

      this.result.set(result);
      this.reports.set(reports);
    } catch (error) {
      console.error('[ApplicantAssessmentResultDetail] detail.load:error', error);
      this.loadError.set('Не удалось загрузить результат оценки.');
    } finally {
      this.loading.set(false);
    }
  }
}
