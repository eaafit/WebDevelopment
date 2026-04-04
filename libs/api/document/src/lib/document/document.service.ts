import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  CreateDocumentResponseSchema,
  DeleteDocumentResponseSchema,
  DocumentType as RpcDocumentType,
  type CreateDocumentRequest,
  type CreateDocumentResponse,
  type DeleteDocumentRequest,
  type DeleteDocumentResponse,
  type GetDocumentRequest,
  type GetDocumentResponse,
  type ListDocumentsByAssessmentRequest,
  type ListDocumentsByAssessmentResponse,
} from '@notary-portal/api-contracts';
import { requireAuth } from '@internal/auth-shared';
import { DocumentType as PrismaDocumentType } from '@internal/prisma-client';
import { Injectable } from '@nestjs/common';
import { DocumentRepository } from './document.repository';
import type { DocumentQuery } from './document.query';
import { DocumentStorageService } from './document-storage.service';
import { toPrismaDocumentType } from './document-type.mapper';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly documentStorageService: DocumentStorageService,
  ) {}

  listDocumentsByAssessment(
    request: ListDocumentsByAssessmentRequest,
  ): Promise<ListDocumentsByAssessmentResponse> {
    if (request.assessmentId?.trim()) {
      validateUuid(request.assessmentId.trim(), 'assessment_id');
    }

    return this.documentRepository.listDocumentsByAssessment(this.normalizeListRequest(request));
  }

  getDocument(request: GetDocumentRequest): Promise<GetDocumentResponse> {
    validateUuid(request.id, 'id');
    return this.documentRepository.getDocument(request.id);
  }

  async createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    const currentUser = requireAuth();
    const assessmentId = request.assessmentId.trim();
    const fileName = request.fileName.trim();
    const fileContent = request.fileContent.length ? request.fileContent : undefined;

    validateUuid(assessmentId, 'assessment_id');
    if (!fileName) throw invalid('file_name', 'is required');

    const uploadedById = resolveUploadedById(request.uploadedById, currentUser.sub);
    const fileType = request.fileType?.trim() || 'application/octet-stream';
    const documentType = toPrismaDocumentType(
      request.documentType,
      inferDocumentType(fileType, fileName),
    );

    const assessmentExists = await this.documentRepository.assessmentExists(assessmentId);
    if (!assessmentExists) {
      throw new ConnectError(`assessment ${assessmentId} not found`, Code.NotFound);
    }

    if (fileContent) {
      let filePath: string | undefined;

      try {
        filePath = await this.documentStorageService.saveFile({
          assessmentId,
          fileName,
          content: fileContent,
        });

        const document = await this.documentRepository.createDocument({
          assessmentId,
          fileName,
          fileType,
          documentType,
          filePath,
          uploadedById,
        });

        return create(CreateDocumentResponseSchema, { document });
      } catch (error: unknown) {
        if (filePath) {
          await this.documentStorageService.deleteFile(filePath).catch(() => undefined);
        }
        throw error;
      }
    }

    const filePath = request.filePath.trim();
    if (!filePath) throw invalid('file_path', 'is required when file_content is empty');

    const document = await this.documentRepository.createDocument({
      assessmentId,
      fileName,
      fileType,
      documentType,
      filePath,
      uploadedById,
    });

    return create(CreateDocumentResponseSchema, { document });
  }

  async deleteDocument(request: DeleteDocumentRequest): Promise<DeleteDocumentResponse> {
    validateUuid(request.id, 'id');

    const deletedDocument = await this.documentRepository.deleteDocument(request.id);
    await this.documentStorageService.deleteFile(deletedDocument.filePath);

    return create(DeleteDocumentResponseSchema, { success: true });
  }

  private normalizeListRequest(request: ListDocumentsByAssessmentRequest): DocumentQuery {
    const filters = request.filters;

    return {
      page: normalizePositiveInt(request.pagination?.page, DEFAULT_PAGE),
      limit: normalizePositiveInt(request.pagination?.limit, DEFAULT_LIMIT),
      assessmentId: request.assessmentId?.trim() || undefined,
      uploadedById: filters?.uploadedById?.trim() || undefined,
      documentType:
        filters && filters.documentType !== RpcDocumentType.UNSPECIFIED
          ? toPrismaDocumentType(filters.documentType, PrismaDocumentType.Other)
          : undefined,
    };
  }
}

function resolveUploadedById(requestValue: string | undefined, currentUserId: string): string {
  const uploadedById = requestValue?.trim() || currentUserId;
  validateUuid(uploadedById, 'uploaded_by_id');

  if (uploadedById !== currentUserId) {
    throw new ConnectError(
      'uploaded_by_id must match the authenticated user',
      Code.PermissionDenied,
    );
  }

  return uploadedById;
}

function inferDocumentType(fileType: string, fileName: string): PrismaDocumentType {
  return isImageFile(fileType, fileName) ? PrismaDocumentType.Photo : PrismaDocumentType.Other;
}

function isImageFile(fileType: string, fileName: string): boolean {
  if (fileType.startsWith('image/')) {
    return true;
  }

  return /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i.test(fileName);
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
