import { Injectable, inject } from '@angular/core';
import { createClient } from '@connectrpc/connect';
import {
  DocumentService as RPCDocumentService,
  DocumentType,
} from '@notary-portal/api-contracts';
import { buildRpcBaseUrl, RPC_TRANSPORT } from '../../rpc/rpc-transport';
import { TokenStore } from '../../rpc/token-store';

export type Document = {
  id: string;
  assessmentId: string;
  fileName: string;
  fileType: string;
  version: number;
  uploadedAt?: { seconds: bigint, nanos: number };
  uploadedById: string;
  downloadUrl: string;
  comment?: string;
};
export type PageInfo = {
  totalItems: number,
  totalPages: number,
  currentPage: number,
  perPage: number,
}

export interface CreateDocumentInput {
  assessmentId: string;
  fileName: string;
  fileType: string;
  uploadedById: string;
  fileContent: Uint8Array<ArrayBuffer>;
  documentType?: DocumentType;
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly tokenStore = inject(TokenStore);
  private readonly transport = inject(RPC_TRANSPORT);

  private readonly client = createClient(RPCDocumentService, this.transport);

  readonly role = this.tokenStore.role;

  async createDocument(input: CreateDocumentInput): Promise<Document> {
    const res = await this.client.createDocument({
      assessmentId: input.assessmentId,
      fileName: input.fileName,
      fileType: input.fileType,
      uploadedById: input.uploadedById,
      documentType: input.documentType ?? DocumentType.OTHER,
      fileContent: input.fileContent,
    });
    if (!res.document) throw new Error('Не удалось создать документ');
    return res.document
  }

  async getDocument(id: string): Promise<Document> {
    const res = await this.client.getDocument({ id });
    if (!res.document) throw new Error('Несуществующий документ');
    return { ...res.document, downloadUrl: resolveStoredDocumentUrl(res.document.downloadUrl) }
  }

  async listDocumentsByAssessment(
    assessmentId?: string, 
    params?: { 
      page: number; 
      limit: number; 
      fileName?: string; 
      dateFrom?: string; 
      dateTo?: string; 
    }
  ): Promise<{
    documents: Document[],
    meta?: PageInfo
  }> {
    const pagination = params ? { page: params.page, limit: params.limit } : undefined;
    const res = await this.client.listDocumentsByAssessment({
      assessmentId: assessmentId ?? '',
      pagination,
    });

    return {
      documents: res.documents.map((document) => ({
        ...document,
        downloadUrl: resolveStoredDocumentUrl(document.downloadUrl),
      })),
      meta: res.meta
    }
  }
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
