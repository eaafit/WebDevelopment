import { DocumentType } from '@notary-portal/api-contracts';

export interface UploadedFile {
  file: File;
  preview: string;
  type: DocumentType;
  documentId?: string;
  quality: 'good' | 'ok' | 'low';
}
