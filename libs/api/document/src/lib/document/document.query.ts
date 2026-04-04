import type { DocumentType as PrismaDocumentType } from '@internal/prisma-client';

export interface DocumentQuery {
  page: number;
  limit: number;
  assessmentId?: string;
  uploadedById?: string;
  documentType?: PrismaDocumentType;
  sortField?: 'uploadedAt' | 'version';
  sortDesc?: boolean;
}
