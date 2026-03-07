import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  CreateReportResponseSchema,
  DeleteReportResponseSchema,
  ReportStatus,
  SignReportResponseSchema,
  type CreateReportRequest,
  type CreateReportResponse,
  type DeleteReportRequest,
  type DeleteReportResponse,
  type GetReportRequest,
  type GetReportResponse,
  type ListReportsRequest,
  type ListReportsResponse,
  type SignReportRequest,
  type SignReportResponse,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';
import { ReportRepository } from './report.repository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ReportService {
  constructor(private readonly reportRepository: ReportRepository) {}

  listReports(request: ListReportsRequest): Promise<ListReportsResponse> {
    return this.reportRepository.listReports({
      page:         request.pagination?.page  || 1,
      limit:        request.pagination?.limit || 10,
      assessmentId: request.filters?.assessmentId || undefined,
      signedById:   request.filters?.signedById   || undefined,
      status:
        request.filters?.status !== ReportStatus.UNSPECIFIED
          ? request.filters?.status
          : undefined,
      sortField: request.sort?.field === 2 ? 'version' : 'generatedAt',
      sortDesc:  request.sort?.descending ?? false,
    });
  }

  getReport(request: GetReportRequest): Promise<GetReportResponse> {
    validateUuid(request.id, 'id');
    return this.reportRepository.getReport(request.id);
  }

  async createReport(request: CreateReportRequest): Promise<CreateReportResponse> {
    validateUuid(request.assessmentId, 'assessment_id');
    validateUuid(request.signedById, 'signed_by_id');
    if (!request.reportPath?.trim()) throw invalid('report_path', 'is required');

    const report = await this.reportRepository.createReport({
      assessmentId: request.assessmentId,
      reportPath:   request.reportPath.trim(),
      signedById:   request.signedById,
    });

    return create(CreateReportResponseSchema, { report });
  }

  async signReport(request: SignReportRequest): Promise<SignReportResponse> {
    validateUuid(request.id, 'id');
    if (!request.signatureData?.length) throw invalid('signature_data', 'is required');

    const report = await this.reportRepository.signReport(
      request.id,
      request.signatureData,
    );

    return create(SignReportResponseSchema, { report });
  }

  async deleteReport(request: DeleteReportRequest): Promise<DeleteReportResponse> {
    validateUuid(request.id, 'id');
    const success = await this.reportRepository.deleteReport(request.id);
    return create(DeleteReportResponseSchema, { success });
  }
}

function validateUuid(value: string | undefined, fieldName: string): void {
  if (!value || !UUID_PATTERN.test(value)) {
    throw invalid(fieldName, 'must be a valid UUID');
  }
}

function invalid(field: string, msg: string): ConnectError {
  return new ConnectError(`${field} ${msg}`, Code.InvalidArgument);
}
