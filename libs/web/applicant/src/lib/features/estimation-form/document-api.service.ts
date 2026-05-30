import { Injectable, inject } from '@angular/core';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { DocumentService, DocumentType, type Document } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT, buildRpcBaseUrl } from '@notary-portal/ui';
import type { AssessmentDocumentModel } from './estimation-form.models';

export type UploadGroup = 'documents' | 'photos' | 'additional';

@Injectable({ providedIn: 'root' })
export class DocumentApiService {
  private readonly client = createClient(DocumentService, inject(RPC_TRANSPORT));

  async listDocumentsByAssessment(assessmentId: string): Promise<AssessmentDocumentModel[]> {
    const response = await this.client.listDocumentsByAssessment({
      assessmentId,
      pagination: {
        page: 1,
        limit: 100,
      },
    });

    return response.documents.map((document) => this.toDocumentModel(document));
  }

  async uploadDocument(params: {
    assessmentId: string;
    file: File;
    group: UploadGroup;
  }): Promise<AssessmentDocumentModel> {
    const response = await this.client.createDocument({
      assessmentId: params.assessmentId,
      fileName: params.file.name,
      fileType: params.file.type || 'application/octet-stream',
      uploadedById: '',
      documentType: resolveDocumentType(params.group),
      fileContent: new Uint8Array(await params.file.arrayBuffer()),
    });

    if (!response.document) {
      throw new Error(`Backend did not return document metadata for file "${params.file.name}"`);
    }

    return this.toDocumentModel(response.document);
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.client.deleteDocument({ id: documentId });
  }

  private toDocumentModel(document: Document): AssessmentDocumentModel {
    const resolvedPreviewUrl = resolveStoredDocumentUrl(document.previewUrl);
    const resolvedDownloadUrl = resolveStoredDocumentUrl(document.downloadUrl);

    return {
      id: document.id,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      previewUrl: resolvedPreviewUrl,
      downloadUrl: resolvedDownloadUrl,
      version: document.version,
      uploadedAt: document.uploadedAt ? timestampDate(document.uploadedAt).toISOString() : null,
      kind: resolveStoredDocumentKind(document.documentType),
    };
  }
}

function resolveDocumentType(group: UploadGroup): DocumentType {
  if (group === 'photos') {
    return DocumentType.PHOTO;
  }

  if (group === 'additional') {
    return DocumentType.ADDITIONAL;
  }

  return DocumentType.OTHER;
}

function resolveStoredDocumentKind(documentType: DocumentType): AssessmentDocumentModel['kind'] {
  if (documentType === DocumentType.PHOTO) {
    return 'photo';
  }

  if (documentType === DocumentType.ADDITIONAL) {
    return 'additional';
  }

  return 'document';
}

function resolveStoredDocumentUrl(fileUrl: string): string {
  const normalizedPath = fileUrl.trim();
  if (!normalizedPath) {
    return '';
  }

  try {
    return new URL(normalizedPath, ensureTrailingSlash(buildRpcBaseUrl())).toString();
  } catch {
    return normalizedPath;
  }
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
