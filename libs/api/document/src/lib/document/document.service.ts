import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  CreateDocumentResponseSchema,
  DeleteDocumentResponseSchema,
  DocumentStatus as RpcDocumentStatus,
  DocumentType as RpcDocumentType,
  UpdateDocumentStatusResponseSchema,
  type CreateDocumentRequest,
  type CreateDocumentResponse,
  type DeleteDocumentRequest,
  type DeleteDocumentResponse,
  type GetDocumentRequest,
  type GetDocumentResponse,
  type ListDocumentsByAssessmentRequest,
  type ListDocumentsByAssessmentResponse,
  type UpdateDocumentStatusRequest,
  type UpdateDocumentStatusResponse,
} from '@notary-portal/api-contracts';
import { getCurrentUser, requireAuth, requireRole, requireSelfOrRole, Role } from '@internal/auth-shared';
import {
  DocumentStatus as PrismaDocumentStatus,
  DocumentType as PrismaDocumentType,
} from '@internal/prisma-client';
import { Injectable } from '@nestjs/common';
import {
  BusinessOperations,
  NotarySpanAttributes,
  markSpanFailure,
  normalizeSpanActorRole,
  normalizeSpanContentType,
  runInSpan,
  setSpanAttributes,
  spanSizeBucket,
} from '@internal/tracing';
import * as path from 'path';
import { Readable } from 'stream';
import { DocumentRecordNotFoundError, DocumentRepository } from './document.repository';
import type { DocumentQuery } from './document.query';
import {
  DocumentObjectNotFoundError,
  DocumentStorageService,
  DocumentStorageUnavailableError,
} from './document-storage.service';
import { toPrismaDocumentStatus, toPrismaDocumentType } from './document-type.mapper';

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
    return runInSpan(
      'DocumentService.createDocument',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.documentCreate,
        [NotarySpanAttributes.entity]: 'Document',
        'notary.actor.role': normalizeSpanActorRole(getCurrentUser()?.role),
        'document.content_type': normalizeSpanContentType(request.fileType),
        'document.size_bucket': spanSizeBucket(request.fileContent.length),
      },
      async (span) => {
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
        setSpanAttributes(span, {
          'document.type': documentType,
          'document.content_type': normalizeSpanContentType(fileType),
          'document.size_bucket': spanSizeBucket(fileContent.length),
        });

        const assessmentExists = await runInSpan(
          'DocumentRepository.assessmentExists',
          {
            'notary.operation': 'document.assessment_exists_check',
            'notary.entity': 'Assessment',
            'db.operation': 'select',
          },
          () => this.documentRepository.assessmentExists(assessmentId),
        );
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
          const savedFile = await this.documentStorageService.saveFile({
            assessmentId,
            fileName,
            content: fileContent,
            contentType: fileType,
            documentType,
          });
          storedFile = savedFile;

          const document = await runInSpan(
            'DocumentRepository.createDocument',
            {
              'notary.operation': 'document.repository.create',
              'notary.entity': 'Document',
              'db.operation': 'insert',
              'document.type': documentType,
              'document.content_type': normalizeSpanContentType(fileType),
              'document.size_bucket': spanSizeBucket(savedFile.fileSize),
            },
            () =>
              this.documentRepository.createDocument({
                assessmentId,
                fileName,
                fileType,
                fileSize: savedFile.fileSize,
                documentType,
                comment: normalizeComment(request.comment),
                price: normalizePrice(request.price),
                bucketName: savedFile.bucketName,
                objectKey: savedFile.objectKey,
                uploadedById,
              }),
          );

          return create(CreateDocumentResponseSchema, { document });
        } catch (error: unknown) {
          if (storedFile) {
            const rollbackFile = storedFile;
            await runInSpan(
              'DocumentStorageService.rollbackDeleteFile',
              {
                'notary.operation': 'document.storage.rollback_delete',
                'notary.entity': 'Document',
                'document.type': documentType,
              },
              async (rollbackSpan) => {
                try {
                  await this.documentStorageService.deleteFile({
                    bucketName: rollbackFile.bucketName,
                    objectKey: rollbackFile.objectKey,
                  });
                } catch (rollbackError) {
                  markSpanFailure(rollbackSpan, rollbackError);
                }
              },
            );
          }

          throw toConnectStorageError(error);
        }
      },
    );
  }

  async deleteDocument(request: DeleteDocumentRequest): Promise<DeleteDocumentResponse> {
    return runInSpan(
      'DocumentService.deleteDocument',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.documentDelete,
        [NotarySpanAttributes.entity]: 'Document',
      },
      async (span) => {
        validateUuid(request.id, 'id');

        const document = await this.documentRepository.findDocumentRecord(request.id);
        if (!document) {
          throw new ConnectError(`document ${request.id} not found`, Code.NotFound);
        }
        setSpanAttributes(span, {
          'document.type': document.documentType,
          'document.content_type': normalizeSpanContentType(document.fileType),
          'document.size_bucket': spanSizeBucket(document.fileSize),
        });

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
      },
    );
  }

  // Сменить собственный статус заказа копии. Переходы валидируются по правилам
  // жизненного цикла и роли: «Взять в работу»/«Готово» — только нотариус,
  // оплата/получение/отмена — владелец заказа или нотариус.
  async updateDocumentStatus(
    request: UpdateDocumentStatusRequest,
  ): Promise<UpdateDocumentStatusResponse> {
    return runInSpan(
      'DocumentService.updateDocumentStatus',
      {
        [NotarySpanAttributes.operation]: 'document.status_update',
        [NotarySpanAttributes.entity]: 'Document',
        'notary.actor.role': normalizeSpanActorRole(getCurrentUser()?.role),
      },
      async (span) => {
        validateUuid(request.id, 'id');
        if (request.status === RpcDocumentStatus.UNSPECIFIED) {
          throw invalid('status', 'must be specified');
        }

        const targetStatus = toPrismaDocumentStatus(
          request.status,
          PrismaDocumentStatus.PendingPayment,
        );

        const document = await this.documentRepository.findDocumentRecord(request.id);
        if (!document) {
          throw new ConnectError(`document ${request.id} not found`, Code.NotFound);
        }

        assertStatusTransition(document.status, targetStatus, document.uploadedById);
        setSpanAttributes(span, {
          'document.status_from': document.status,
          'document.status_to': targetStatus,
        });

        const updated = await this.documentRepository.updateDocumentStatus(request.id, targetStatus);
        return create(UpdateDocumentStatusResponseSchema, { document: updated });
      },
    );
  }

  async getDocumentFile(documentId: string): Promise<{
    body: Readable;
    fileName: string;
    fileType: string;
    fileSize: number;
  } | null> {
    return runInSpan(
      'DocumentService.getDocumentFile',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.documentContentOpen,
        [NotarySpanAttributes.entity]: 'Document',
      },
      async (span) => {
        validateUuid(documentId, 'id');

        const document = await this.documentRepository.findDocumentRecord(documentId);
        if (!document) {
          return null;
        }
        setSpanAttributes(span, {
          'document.type': document.documentType,
          'document.content_type': normalizeSpanContentType(document.fileType),
          'document.size_bucket': spanSizeBucket(document.fileSize),
        });

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
      },
    );
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

function normalizeComment(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 2000) : undefined;
}

function normalizePrice(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

// Переходы статуса, доступные только нотариусу.
const NOTARY_ONLY_TRANSITIONS: ReadonlyArray<[PrismaDocumentStatus, PrismaDocumentStatus]> = [
  [PrismaDocumentStatus.Paid, PrismaDocumentStatus.InProgress], // «Взять в работу»
  [PrismaDocumentStatus.InProgress, PrismaDocumentStatus.Ready], // «Готово»
];

// Переходы статуса, доступные владельцу заказа или нотариусу.
const OWNER_OR_NOTARY_TRANSITIONS: ReadonlyArray<[PrismaDocumentStatus, PrismaDocumentStatus]> = [
  [PrismaDocumentStatus.PendingPayment, PrismaDocumentStatus.Paid], // оплата
  [PrismaDocumentStatus.Ready, PrismaDocumentStatus.Delivered], // получение
  [PrismaDocumentStatus.PendingPayment, PrismaDocumentStatus.Cancelled],
  [PrismaDocumentStatus.Paid, PrismaDocumentStatus.Cancelled],
  [PrismaDocumentStatus.InProgress, PrismaDocumentStatus.Cancelled],
  [PrismaDocumentStatus.Ready, PrismaDocumentStatus.Cancelled],
];

function matches(
  list: ReadonlyArray<[PrismaDocumentStatus, PrismaDocumentStatus]>,
  from: PrismaDocumentStatus,
  to: PrismaDocumentStatus,
): boolean {
  return list.some(([f, t]) => f === from && t === to);
}

// Проверяет допустимость перехода статуса и права роли (бросает ConnectError при нарушении).
function assertStatusTransition(
  from: PrismaDocumentStatus,
  to: PrismaDocumentStatus,
  ownerId: string,
): void {
  if (matches(NOTARY_ONLY_TRANSITIONS, from, to)) {
    requireRole(Role.Notary);
    return;
  }
  if (matches(OWNER_OR_NOTARY_TRANSITIONS, from, to)) {
    requireSelfOrRole(ownerId, Role.Notary);
    return;
  }
  throw new ConnectError(`invalid status transition ${from} -> ${to}`, Code.FailedPrecondition);
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
