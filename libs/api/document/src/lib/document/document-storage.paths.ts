export const DOCUMENT_CONTENT_ROUTE_BASE = '/api/documents';

export type DocumentContentMode = 'preview' | 'download';

export interface BuildDocumentContentPathParams {
  documentId: string;
  mode: DocumentContentMode;
  expiresAtEpochSec: number;
  signature: string;
}

export function buildDocumentContentPath(params: BuildDocumentContentPathParams): string {
  const searchParams = new URLSearchParams({
    mode: params.mode,
    expires: String(params.expiresAtEpochSec),
    signature: params.signature,
  });

  return `${DOCUMENT_CONTENT_ROUTE_BASE}/${encodeURIComponent(params.documentId)}/content?${searchParams.toString()}`;
}
