import { Injectable } from '@nestjs/common';
import { ReportService } from './report.service';
import type {
  CreateReportRequest,
  CreateReportResponse,
  DeleteReportRequest,
  DeleteReportResponse,
  GetReportRequest,
  GetReportResponse,
  ListReportsRequest,
  ListReportsResponse,
  SignReportRequest,
  SignReportResponse,
} from '@notary-portal/api-contracts';

@Injectable()
export class ReportRpcService {
  constructor(private readonly reportService: ReportService) {}

  readonly listReports  = (r: ListReportsRequest):  Promise<ListReportsResponse>  =>
    this.reportService.listReports(r);

  readonly getReport    = (r: GetReportRequest):    Promise<GetReportResponse>    =>
    this.reportService.getReport(r);

  readonly createReport = (r: CreateReportRequest): Promise<CreateReportResponse> =>
    this.reportService.createReport(r);

  readonly signReport   = (r: SignReportRequest):   Promise<SignReportResponse>   =>
    this.reportService.signReport(r);

  readonly deleteReport = (r: DeleteReportRequest): Promise<DeleteReportResponse> =>
    this.reportService.deleteReport(r);
}
