import type { DocumentType as RpcDocumentType } from '@notary-portal/api-contracts';

export interface DocumentQuery {
  page: number;
  limit: number;
  assessmentId?: string;
  uploadedById?: string;
  documentType?: RpcDocumentType;
  sortField?: 'uploadedAt' | 'version';
  sortDesc?: boolean;
}
