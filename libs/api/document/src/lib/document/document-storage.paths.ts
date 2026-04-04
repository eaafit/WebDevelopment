import path from 'path';

export const DOCUMENT_UPLOADS_ROUTE = '/uploads';
const DOCUMENT_UPLOADS_ENV = 'DOCUMENT_UPLOAD_DIR';

export function getDocumentUploadsRoot(): string {
  const configuredRoot = process.env[DOCUMENT_UPLOADS_ENV]?.trim();
  return path.resolve(configuredRoot || path.join(process.cwd(), 'uploads'));
}
