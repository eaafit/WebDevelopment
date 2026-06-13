import { Code, ConnectError } from '@connectrpc/connect';
import type express from 'express';
import {
  DocumentObjectNotFoundError,
  DocumentStorageUnavailableError,
  type DocumentFileUrlService,
  type DocumentService,
} from '@internal/document';
import {
  BusinessOperations,
  NotarySpanAttributes,
  markSpanFailure,
  runInSpan,
  setSpanAttributes,
} from '@internal/tracing';

export interface DocumentContentRouteServices {
  documentService: Pick<DocumentService, 'getDocumentFile'>;
  documentFileUrlService: Pick<DocumentFileUrlService, 'validateAccess'>;
}

export async function handleDocumentContentRequest(
  req: express.Request,
  res: express.Response,
  services: DocumentContentRouteServices,
): Promise<void> {
  await runInSpan(
    'DocumentContentRoute.prepareStream',
    {
      [NotarySpanAttributes.operation]: BusinessOperations.documentContentStreamPrepare,
      [NotarySpanAttributes.entity]: 'Document',
    },
    async (span) => {
      const documentId = req.params['documentId'] ?? '';
      const accessGrant = await runInSpan(
        'DocumentFileUrlService.validateAccess',
        {
          'notary.operation': 'document.content.signed_url_validate',
          'notary.entity': 'Document',
        },
        () =>
          services.documentFileUrlService.validateAccess({
            documentId,
            mode: asString(req.query['mode']),
            expires: asString(req.query['expires']),
            signature: asString(req.query['signature']),
          }),
      );

      if (!accessGrant) {
        markSpanFailure(span, new Error('Document content access denied'));
        setSpanAttributes(span, { 'document.content.prepare_result': 'access_denied' });
        res.status(403).json({ error: 'invalid or expired document url' });
        return;
      }

      try {
        const file = await services.documentService.getDocumentFile(
          documentId,
          asString(req.query['variant']),
        );
        if (!file) {
          markSpanFailure(span, new Error('Document content not found'));
          setSpanAttributes(span, { 'document.content.prepare_result': 'not_found' });
          res.status(404).json({ error: `document ${documentId} not found` });
          return;
        }
        setSpanAttributes(span, {
          'document.content.prepare_result': 'prepared',
          'document.content.mode': accessGrant.mode,
        });

        res.setHeader('Content-Type', file.fileType);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.setHeader(
          'Content-Disposition',
          buildContentDisposition(
            accessGrant.mode === 'download' ? 'attachment' : 'inline',
            file.fileName,
          ),
        );

        if (file.fileSize > 0) {
          res.setHeader('Content-Length', String(file.fileSize));
        }

        // This span covers signed URL validation and stream preparation; the stream continues after pipe().
        file.body.pipe(res);
      } catch (error: unknown) {
        markSpanFailure(span, error);
        setSpanAttributes(span, { 'document.content.prepare_result': 'error' });
        writeDocumentFileError(res, error);
      }
    },
  );
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function writeDocumentFileError(res: express.Response, error: unknown): void {
  if (error instanceof DocumentObjectNotFoundError) {
    res.status(404).json({ error: 'document file not found' });
    return;
  }

  if (error instanceof DocumentStorageUnavailableError) {
    res.status(503).json({ error: 'document object storage unavailable' });
    return;
  }

  if (error instanceof ConnectError) {
    if (error.code === Code.InvalidArgument) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (error.code === Code.NotFound) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error.code === Code.Unavailable) {
      res.status(503).json({ error: error.message });
      return;
    }
  }

  res.status(500).json({ error: 'unexpected document file error' });
}

function buildContentDisposition(
  dispositionType: 'inline' | 'attachment',
  fileName: string,
): string {
  const safeFileName = sanitizeAsciiFileName(fileName);
  const encodedFileName = encodeRfc5987(fileName);
  return `${dispositionType}; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`;
}

function sanitizeAsciiFileName(fileName: string): string {
  const sanitized = fileName
    .replace(/[/\\"]/g, '_')
    .replace(/[^\x20-\x7E]+/g, '_')
    .trim();

  return sanitized || 'document';
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
