import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  ReportService,
  ReportStatus,
  type AssessmentReport as RpcAssessmentReport,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { type AssessmentReport, DEMO_SIGNED_REPORT_PDF_URL } from './assessment-report.models';

@Injectable({ providedIn: 'root' })
export class ReportApiService {
  private readonly client = createClient(ReportService, inject(RPC_TRANSPORT));

  async listAssessmentReports(assessmentId: string): Promise<AssessmentReport[]> {
    const response = await this.client.listReports({
      pagination: { page: 1, limit: 20 },
      filters: { assessmentId },
    });

    return response.reports.map(toAssessmentReport);
  }
}

function toAssessmentReport(report: RpcAssessmentReport): AssessmentReport {
  const createdAt = report.generatedAt ? timestampDate(report.generatedAt).toISOString() : new Date().toISOString();
  const isSigned = report.status === ReportStatus.SIGNED;

  return {
    id: report.id,
    assessmentId: report.assessmentId,
    title: `Отчёт об оценке v${report.version}`,
    status: isSigned ? 'Signed' : 'Draft',
    createdAt,
    fileUrl: isSigned ? resolveSignedReportUrl(report.reportPath) : null,
    signedAt: isSigned && report.hasSignature ? createdAt : null,
  };
}

function resolveSignedReportUrl(reportPath: string): string {
  if (reportPath.startsWith('http://') || reportPath.startsWith('https://')) {
    return reportPath;
  }

  return DEMO_SIGNED_REPORT_PDF_URL;
}
