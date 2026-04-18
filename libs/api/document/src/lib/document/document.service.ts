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
import path from 'path';
import { Readable } from 'stream';
import { DocumentRecordNotFoundError, DocumentRepository } from './document.repository';
import type { DocumentQuery } from './document.query';
import {
  DocumentObjectNotFoundError,
  DocumentStorageService,
  DocumentStorageUnavailableError,
} from './document-storage.service';
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
    return this.documentRepository.getDocument(request.id).catch((error: unknown) => {
      if (error instanceof DocumentRecordNotFoundError) {
        throw new ConnectError(`document ${request.id} not found`, Code.NotFound);
      }

      throw error;
    });
  }

  async createDocument(request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    const currentUser = requireAuth();
    const assessmentId = request.assessmentId.trim();
    const fileName = normalizeDisplayFileName(request.fileName);
    const fileContent = request.fileContent.length ? request.fileContent : undefined;

    validateUuid(assessmentId, 'assessment_id');
    if (!fileName) throw invalid('file_name', 'is required');
    if (!fileContent) throw invalid('file_content', 'is required');

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

    let storedFile:
      | {
          bucketName: string;
          objectKey: string;
          fileSize: number;
        }
      | undefined;

    try {
      storedFile = await this.documentStorageService.saveFile({
        assessmentId,
        fileName,
        content: fileContent,
        contentType: fileType,
        documentType,
      });

      const document = await this.documentRepository.createDocument({
        assessmentId,
        fileName,
        fileType,
        fileSize: storedFile.fileSize,
        documentType,
        bucketName: storedFile.bucketName,
        objectKey: storedFile.objectKey,
        uploadedById,
      });

      return create(CreateDocumentResponseSchema, { document });
    } catch (error: unknown) {
      if (storedFile) {
        await this.documentStorageService
          .deleteFile({
            bucketName: storedFile.bucketName,
            objectKey: storedFile.objectKey,
          })
          .catch(() => undefined);
      }

      throw toConnectStorageError(error);
    }
  }

  async deleteDocument(request: DeleteDocumentRequest): Promise<DeleteDocumentResponse> {
    validateUuid(request.id, 'id');

    const document = await this.documentRepository.findDocumentRecord(request.id);
    if (!document) {
      throw new ConnectError(`document ${request.id} not found`, Code.NotFound);
    }

    try {
      await this.documentStorageService.deleteFile({
        bucketName: document.bucketName,
        objectKey: document.objectKey,
      });
    } catch (error: unknown) {
      throw toConnectStorageError(error);
    }

    await this.documentRepository.deleteDocument(request.id);

    return create(DeleteDocumentResponseSchema, { success: true });
  }

  async getDocumentFile(documentId: string): Promise<{
    body: Readable;
    fileName: string;
    fileType: string;
    fileSize: number;
  } | null> {
    validateUuid(documentId, 'id');

    const document = await this.documentRepository.findDocumentRecord(documentId);
    if (!document) {
      return null;
    }

    const storedFile = await this.documentStorageService.getFile({
      bucketName: document.bucketName,
      objectKey: document.objectKey,
    });

    return {
      body: storedFile.body,
      fileName: document.fileName,
      fileType: storedFile.contentType || document.fileType || 'application/octet-stream',
      fileSize: storedFile.contentLength ?? document.fileSize,
    };
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

function normalizeDisplayFileName(value: string): string {
  const normalized = path.basename(value).trim().slice(0, 255);
  return normalized || 'document.bin';
}

function toConnectStorageError(error: unknown): never {
  if (error instanceof DocumentObjectNotFoundError) {
    throw new ConnectError('document object not found', Code.NotFound);
  }

  if (error instanceof DocumentStorageUnavailableError) {
    throw new ConnectError('document object storage unavailable', Code.Unavailable);
  }

  throw error;
}
