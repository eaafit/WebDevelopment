import { Injectable, inject } from '@angular/core';
import { createClient } from '@connectrpc/connect';
import { DocumentService as RPCDocumentService } from '@notary-portal/api-contracts';
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
  // Собственный статус заказа копии (DocumentStatus: 1..6), не статус заявки.
  status?: number;
  // Стоимость копии в рублях.
  price?: number;
};
export type PageInfo = {
  totalItems: number,
  totalPages: number,
  currentPage: number,
  perPage: number,
}
@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly tokenStore = inject(TokenStore);
  private readonly transport = inject(RPC_TRANSPORT);

  private readonly client = createClient(RPCDocumentService, this.transport);

  readonly role = this.tokenStore.role;

  async createDocument(
    assessmentId: string,
    fileName: string,
    fileType: string,
    uploadedById: string,
    fileContent: Uint8Array<ArrayBuffer>,
    options?: { comment?: string; price?: number; documentType?: number },
  ): Promise<Document> {
    const res = await this.client.createDocument({
      assessmentId,
      fileName,
      fileType,
      uploadedById,
      fileContent,
      comment: options?.comment ?? '',
      price: options?.price ?? 0,
      documentType: options?.documentType ?? 0,
    });
    if (!res.document) throw new Error('Не удалось создать документ');
    return res.document
  }

  async getDocument(id: string): Promise<Document> {
    const res = await this.client.getDocument({ id });
    if (!res.document) throw new Error('Несуществующий документ');
    return { ...res.document, downloadUrl: resolveStoredDocumentUrl(res.document.downloadUrl) }
  }

  // Сменить статус заказа копии (жизненный цикл DocumentStatus).
  async updateDocumentStatus(id: string, status: number): Promise<Document> {
    const res = await this.client.updateDocumentStatus({ id, status });
    if (!res.document) throw new Error('Не удалось обновить статус заказа');
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
      assessmentId,
      pagination,
      fileName: params?.fileName,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo
    } as any);

    return {
      documents: res.documents.map((v: any) => ({ ...v, downloadUrl: resolveStoredDocumentUrl(v.downloadUrl) })),
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
