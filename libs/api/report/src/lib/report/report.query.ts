import type { ReportStatus as RpcReportStatus } from '@notary-portal/api-contracts';

export interface ReportQuery {
  page: number;
  limit: number;
  assessmentId?: string;
  signedById?: string;
  status?: RpcReportStatus;
  sortField?: 'generatedAt' | 'version';
  sortDesc?: boolean;
}
