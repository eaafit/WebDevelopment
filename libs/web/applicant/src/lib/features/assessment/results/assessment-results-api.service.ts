import { Injectable, inject } from '@angular/core';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  AssessmentService,
  AssessmentStatus,
  ReportService,
  ReportSortField,
  ReportStatus,
  type Assessment,
  type AssessmentReport as RpcAssessmentReport,
} from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { OBJECT_TYPE_OPTIONS } from '../../estimation-form/estimation-form.models';
import type {
  AssessmentReport,
  AssessmentResultModel,
  CalculationBreakdownRow,
} from './assessment-results.models';

const RESULTS_PAGE_LIMIT = 50;
const REPORTS_PAGE_LIMIT = 20;
const MOCK_REPORT_FILE_URL = '/mock/assessment-report.pdf';

/** Статусы, при которых у заявки есть итог оценки. */
export const RESULT_STATUSES: ReadonlyArray<AssessmentStatus> = [AssessmentStatus.COMPLETED];

@Injectable({ providedIn: 'root' })
export class AssessmentResultsApiService {
  private readonly client = createClient(AssessmentService, inject(RPC_TRANSPORT));
  private readonly reportClient = createClient(ReportService, inject(RPC_TRANSPORT));

  async listResults(userId: string): Promise<AssessmentResultModel[]> {
    const responses = await Promise.all(
      RESULT_STATUSES.map((statusFilter) =>
        this.client.listAssessments({
          userId,
          statusFilter,
          pagination: { page: 1, limit: RESULTS_PAGE_LIMIT },
        }),
      ),
    );

    return responses
      .flatMap((response) => response.assessments)
      .filter((assessment) => RESULT_STATUSES.includes(assessment.status))
      .map(toAssessmentResultModel)
      .sort((a, b) => (b.assessedAt ?? '').localeCompare(a.assessedAt ?? ''));
  }

  /** Возвращает null, если заявка не найдена или ещё не оценена. */
  async getResult(assessmentId: string): Promise<AssessmentResultModel | null> {
    const response = await this.client.getAssessment({ id: assessmentId });
    const assessment = response.assessment;
    if (!assessment || !RESULT_STATUSES.includes(assessment.status)) {
      return null;
    }

    return toAssessmentResultModel(assessment);
  }

  async listReports(assessmentId: string): Promise<AssessmentReport[]> {
    const response = await this.reportClient.listReports({
      pagination: { page: 1, limit: REPORTS_PAGE_LIMIT },
      filters: { assessmentId },
      sort: { field: ReportSortField.VERSION, descending: true },
    });

    return response.reports.map(toAssessmentReport);
  }
}

function toAssessmentReport(report: RpcAssessmentReport): AssessmentReport {
  const createdAt = report.generatedAt ? timestampDate(report.generatedAt).toISOString() : '';
  const isSigned = report.status === ReportStatus.SIGNED;

  return {
    id: report.id,
    assessmentId: report.assessmentId,
    title: `Отчёт об оценке, версия ${report.version}`,
    status: isSigned ? 'Signed' : 'Draft',
    createdAt,
    fileUrl: isSigned ? resolveReportFileUrl(report.reportPath) : null,
    signedAt: isSigned && report.hasSignature ? createdAt : null,
  };
}

// TODO: заменить на ссылку из файлового хранилища, когда API начнёт отдавать URL для скачивания;
// сейчас report_path — внутренний путь, поэтому для таких отчётов открывается демо-PDF.
function resolveReportFileUrl(reportPath: string): string {
  return /^https?:\/\//.test(reportPath) ? reportPath : MOCK_REPORT_FILE_URL;
}

// TODO: заменить на реальную детализацию расчёта, когда бэкенд начнёт её отдавать.
export function buildMockBreakdown(finalValue: number | null): CalculationBreakdownRow[] {
  if (finalValue === null) {
    return [];
  }

  const marketValue = Math.round(finalValue / 0.95);
  return [
    { label: 'Рыночная стоимость', value: marketValue, hint: 'Сравнительный подход' },
    {
      label: 'Корректировки',
      value: finalValue - marketValue,
      hint: 'Состояние, этаж, торг',
    },
    { label: 'Итоговая стоимость', value: finalValue },
  ];
}

function toAssessmentResultModel(assessment: Assessment): AssessmentResultModel {
  const realEstateObject = assessment.realEstateObject;
  const objectType = realEstateObject?.objectType;
  const assessedAt = assessment.updatedAt ?? assessment.createdAt;

  return {
    id: assessment.id,
    address: realEstateObject?.address || assessment.address,
    objectTypeLabel:
      OBJECT_TYPE_OPTIONS.find((option) => option.value === String(objectType))?.label ??
      'Не указан',
    area: realEstateObject?.area ?? '',
    finalEstimatedValue: parseMoney(assessment.estimatedValue),
    assessedAt: assessedAt ? timestampDate(assessedAt).toISOString() : null,
  };
}

function parseMoney(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
