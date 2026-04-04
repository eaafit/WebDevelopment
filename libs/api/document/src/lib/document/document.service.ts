import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  CreateDocumentResponseSchema,
  type CreateDocumentRequest,
  type CreateDocumentResponse,
  type GetDocumentRequest,
  type GetDocumentResponse,
  type ListDocumentsByAssessmentRequest,
  type ListDocumentsByAssessmentResponse,
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

  listDocumentsByAssessment(
    request: ListDocumentsByAssessmentRequest
  ): Promise<ListDocumentsByAssessmentResponse> {
    return this.documentRepository.listDocumentsByAssessment(this.normalizeListRequest(request));
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
      documentType: PrismaDocumentType.Other,
      filePath: request.filePath.trim(),
      uploadedById: request.uploadedById,
    });

    return create(CreateDocumentResponseSchema, { document });
  }

  private normalizeListRequest(request: ListDocumentsByAssessmentRequest): DocumentQuery {
    return {
      page: normalizePositiveInt(request.pagination?.page, DEFAULT_PAGE),
      limit: normalizePositiveInt(request.pagination?.limit, DEFAULT_LIMIT),
      assessmentId: request.assessmentId || undefined,
    };
  }
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
