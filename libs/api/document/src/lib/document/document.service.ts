import { Code, ConnectError } from '@connectrpc/connect';
import {
  DocumentType as RpcDocumentType,
  type CreateDocumentRequest,
  type CreateDocumentResponse,
  type DeleteDocumentRequest,
  type DeleteDocumentResponse,
  type GetDocumentRequest,
  type GetDocumentResponse,
  type ListDocumentsRequest,
  type ListDocumentsResponse,
} from '@notary-portal/api-contracts';
import { DocumentType as PrismaDocumentType } from '@internal/prisma-client';
import { Injectable } from '@nestjs/common';
import { DocumentRepository } from './document.repository';
import type { DocumentQuery } from './document.query';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class DocumentService {
  constructor(private readonly documentRepository: DocumentRepository) {}

  listDocuments(request: ListDocumentsRequest): Promise<ListDocumentsResponse> {
    return this.documentRepository.listDocuments(this.normalizeListRequest(request));
  }

  getDocument(request: GetDocumentRequest): Promise<GetDocumentResponse> {
    validateUuid(request.id, 'id');
    return this.documentRepository.getDocument(request.id);
  }

  async createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    validateUuid(request.assessmentId, 'assessment_id');
    validateUuid(request.uploadedById, 'uploaded_by_id');
    if (!request.fileName?.trim()) throw invalid('file_name', 'is required');
    if (!request.filePath?.trim()) throw invalid('file_path', 'is required');

    const document = await this.documentRepository.createDocument({
      assessmentId: request.assessmentId,
      fileName: request.fileName.trim(),
      fileType: request.fileType?.trim() || 'application/octet-stream',
      documentType: toPrismaDocumentType(request.documentType),
      filePath: request.filePath.trim(),
      uploadedById: request.uploadedById,
    });

    return { document };
  }

  async deleteDocument(request: DeleteDocumentRequest): Promise<DeleteDocumentResponse> {
    validateUuid(request.id, 'id');
    const success = await this.documentRepository.deleteDocument(request.id);
    return { success };
  }

  private normalizeListRequest(request: ListDocumentsRequest): DocumentQuery {
    const f = request.filters;
    const s = request.sort;
    return {
      page: normalizePositiveInt(request.pagination?.page, DEFAULT_PAGE),
      limit: normalizePositiveInt(request.pagination?.limit, DEFAULT_LIMIT),
      assessmentId: f?.assessmentId || undefined,
      uploadedById: f?.uploadedById || undefined,
      documentType:
        f?.documentType === RpcDocumentType.DOCUMENT_TYPE_UNSPECIFIED ? undefined : f?.documentType,
      sortField: s?.field === 2 ? 'version' : 'uploadedAt',
      sortDesc: s?.descending ?? false,
    };
  }
}

function toPrismaDocumentType(t: RpcDocumentType | undefined): PrismaDocumentType {
  const map: Partial<Record<RpcDocumentType, PrismaDocumentType>> = {
    [RpcDocumentType.DOCUMENT_TYPE_PASSPORT]: PrismaDocumentType.Passport,
    [RpcDocumentType.DOCUMENT_TYPE_PROPERTY_DEED]: PrismaDocumentType.PropertyDeed,
    [RpcDocumentType.DOCUMENT_TYPE_TECHNICAL_PLAN]: PrismaDocumentType.TechnicalPlan,
    [RpcDocumentType.DOCUMENT_TYPE_CADASTRAL_PASSPORT]: PrismaDocumentType.CadastralPassport,
    [RpcDocumentType.DOCUMENT_TYPE_PHOTO]: PrismaDocumentType.Photo,
    [RpcDocumentType.DOCUMENT_TYPE_OTHER]: PrismaDocumentType.Other,
  };
  const value = t === undefined ? undefined : map[t];
  return value ?? PrismaDocumentType.Other;
}

function validateUuid(value: string | undefined, fieldName: string): void {
  if (!value || !UUID_PATTERN.test(value)) throw invalid(fieldName, 'must be a valid UUID');
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (!value || value === 0) return fallback;
  if (!Number.isInteger(value) || value < 1)
    throw invalid('pagination', 'page and limit must be positive integers');
  return value;
}

function invalid(field: string, msg: string): ConnectError {
  return new ConnectError(`${field} ${msg}`, Code.InvalidArgument);
}
