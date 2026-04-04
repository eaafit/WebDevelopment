import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  buildDocumentContentPath,
  type DocumentContentMode,
} from './document-storage.paths';

const DOCUMENT_FILE_URL_TTL_SEC = 60 * 60 * 24;

export interface DocumentFileAccessParams {
  documentId: string;
  mode: string | undefined;
  expires: string | undefined;
  signature: string | undefined;
}

export interface DocumentFileAccessGrant {
  mode: DocumentContentMode;
}

@Injectable()
export class DocumentFileUrlService {
  private readonly signingSecret = this.requireEnv('JWT_ACCESS_SECRET');

  buildPreviewUrl(documentId: string): string {
    return this.buildSignedUrl(documentId, 'preview');
  }

  buildDownloadUrl(documentId: string): string {
    return this.buildSignedUrl(documentId, 'download');
  }

  validateAccess(params: DocumentFileAccessParams): DocumentFileAccessGrant | null {
    const mode = normalizeMode(params.mode);
    const expiresAtEpochSec = Number(params.expires);
    const signature = params.signature?.trim() ?? '';

    if (!mode || !Number.isInteger(expiresAtEpochSec) || expiresAtEpochSec < 1 || !signature) {
      return null;
    }

    if (expiresAtEpochSec < Math.floor(Date.now() / 1000)) {
      return null;
    }

    const expectedSignature = this.sign(params.documentId, mode, expiresAtEpochSec);
    if (!constantTimeEquals(signature, expectedSignature)) {
      return null;
    }

    return { mode };
  }

  private buildSignedUrl(documentId: string, mode: DocumentContentMode): string {
    const expiresAtEpochSec = Math.floor(Date.now() / 1000) + DOCUMENT_FILE_URL_TTL_SEC;
    const signature = this.sign(documentId, mode, expiresAtEpochSec);

    return buildDocumentContentPath({
      documentId,
      mode,
      expiresAtEpochSec,
      signature,
    });
  }

  private sign(documentId: string, mode: DocumentContentMode, expiresAtEpochSec: number): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${documentId}:${mode}:${expiresAtEpochSec}`)
      .digest('hex');
  }

  private requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
  }
}

function normalizeMode(value: string | undefined): DocumentContentMode | null {
  if (value === 'preview' || value === 'download') {
    return value;
  }

  return null;
}

function constantTimeEquals(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
