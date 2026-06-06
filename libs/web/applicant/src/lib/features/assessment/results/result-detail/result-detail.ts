import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AssessmentStatus } from '@notary-portal/api-contracts';
import {
  AssessmentResultsApiService,
  type AssessmentResultDetail,
} from '../assessment-results-api.service';
import {
  formatRubles,
  getMockCalculationBreakdown,
  type AssessmentReport,
  type CalculationBreakdownRow,
} from '../assessment-report.models';
import { ReportApiService } from '../report-api.service';

@Component({
  selector: 'lib-assessment-result-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './result-detail.html',
  styleUrl: './result-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssessmentResultDetailComponent {
  readonly assessment = signal<AssessmentResultDetail | null>(null);
  readonly reports = signal<AssessmentReport[]>([]);
  readonly calculationRows = signal<CalculationBreakdownRow[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly isBreakdownExpanded = signal(true);
  readonly downloadingReportId = signal<string | null>(null);

  readonly formattedValue = computed(() => {
    const value = this.assessment()?.estimatedValue;
    return value === null || value === undefined ? '—' : formatRubles(value);
  });

  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AssessmentResultsApiService);
  private readonly reportApi = inject(ReportApiService);

  constructor() {
    void this.loadAssessment();
  }

  toggleBreakdown(): void {
    this.isBreakdownExpanded.update((expanded) => !expanded);
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

  reportStatusLabel(status: AssessmentReport['status']): string {
    return status === 'Signed' ? 'Подписан' : 'Черновик';
  }

  isDownloading(reportId: string): boolean {
    return this.downloadingReportId() === reportId;
  }

  downloadReport(report: AssessmentReport): void {
    if (!report.fileUrl || this.downloadingReportId()) {
      return;
    }

    this.downloadingReportId.set(report.id);
    window.open(report.fileUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => this.downloadingReportId.set(null), 1200);
  }

  private async loadAssessment(): Promise<void> {
    const assessmentId = this.route.snapshot.paramMap.get('assessmentId')?.trim() ?? '';
    if (!assessmentId) {
      this.loadError.set('Не указан идентификатор оценки.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    try {
      const detail = await this.api.getAssessmentResult(assessmentId);
      if (detail.status !== AssessmentStatus.COMPLETED) {
        this.loadError.set('Оценка ещё не завершена. Результаты будут доступны после завершения.');
        return;
      }

      this.assessment.set(detail);
      this.reports.set(await this.reportApi.listAssessmentReports(assessmentId));

      const finalValue = detail.estimatedValue ?? 0;
      this.calculationRows.set(getMockCalculationBreakdown(finalValue));
    } catch {
      this.loadError.set('Не удалось загрузить результат оценки.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
