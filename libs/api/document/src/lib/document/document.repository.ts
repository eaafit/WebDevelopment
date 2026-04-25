import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { PrismaService } from '@internal/prisma';
import { Injectable } from '@nestjs/common';
import {
  DocumentSchema,
  GetDocumentResponseSchema,
  ListDocumentsByAssessmentResponseSchema,
  PaginationMetaSchema,
  type Document as RpcDocument,
  type GetDocumentResponse,
  type ListDocumentsByAssessmentResponse,
} from '@notary-portal/api-contracts';
import {
  DocumentType as PrismaDocumentType,
  type Document as PrismaDocumentRecord,
  type Prisma,
} from '@internal/prisma-client';
import type { DocumentQuery } from './document.query';
import { DocumentFileUrlService } from './document-file-url.service';
import { fromPrismaDocumentType } from './document-type.mapper';

export class DocumentRecordNotFoundError extends Error {
  constructor(id: string) {
    super(`document ${id} not found`);
    this.name = 'DocumentRecordNotFoundError';
  }
}

@Injectable()
export class DocumentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentFileUrlService: DocumentFileUrlService,
  ) {}

  async listDocumentsByAssessment(query: DocumentQuery): Promise<ListDocumentsByAssessmentResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query);

    const [totalItems, documents] = await this.prisma.$transaction([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
    ]);

    return create(ListDocumentsByAssessmentResponseSchema, {
      documents: documents.map((d) => this.toMessage(d)),
      meta: create(PaginationMetaSchema, {
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
        perPage: limit,
      }),
    });
  }

  async getDocument(id: string): Promise<GetDocumentResponse> {
    const document = await this.findDocumentRecord(id);
    if (!document) {
      throw new DocumentRecordNotFoundError(id);
    }

    return create(GetDocumentResponseSchema, { document: this.toMessage(document) });
  }

  findDocumentRecord(id: string): Promise<PrismaDocumentRecord | null> {
    return this.prisma.document.findUnique({ where: { id } });
  }

  async assessmentExists(id: string): Promise<boolean> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      select: { id: true },
    });

    return !!assessment;
  }

  async createDocument(data: {
    assessmentId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    documentType: PrismaDocumentType;
    bucketName: string;
    objectKey: string;
    uploadedById: string;
  }): Promise<RpcDocument> {
    const lastVersion = await this.prisma.document.findFirst({
      where: { assessmentId: data.assessmentId, fileName: data.fileName },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const document = await this.prisma.document.create({
      data: {
        assessmentId: data.assessmentId,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        documentType: data.documentType,
        bucketName: data.bucketName,
        objectKey: data.objectKey,
        uploadedById: data.uploadedById,
        version: (lastVersion?.version ?? 0) + 1,
      },
    });

    return this.toMessage(document);
  }

  async deleteDocument(id: string): Promise<void> {
    await this.prisma.document.delete({ where: { id } });
  }

  private buildWhere(query: DocumentQuery): Prisma.DocumentWhereInput {
    const where: Prisma.DocumentWhereInput = {};
    if (query.assessmentId) where.assessmentId = query.assessmentId;
    if (query.uploadedById) where.uploadedById = query.uploadedById;
    if (query.documentType) where.documentType = query.documentType;
    return where;
  }

  private buildOrderBy(query: DocumentQuery): Prisma.DocumentOrderByWithRelationInput {
    const direction = query.sortDesc ? 'desc' : 'asc';
    return query.sortField === 'version' ? { version: direction } : { uploadedAt: 'desc' };
  }

  private toMessage(d: {
    id: string;
    assessmentId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    bucketName: string;
    objectKey: string;
    version: number;
    uploadedAt: Date;
    uploadedById: string;
    documentType: PrismaDocumentType;
  }): RpcDocument {
    return create(DocumentSchema, {
      id: d.id,
      assessmentId: d.assessmentId,
      fileName: d.fileName,
      fileType: d.fileType,
      fileSize: d.fileSize,
      bucketName: d.bucketName,
      objectKey: d.objectKey,
      version: d.version,
      uploadedAt: timestampFromDate(d.uploadedAt),
      uploadedById: d.uploadedById,
      documentType: fromPrismaDocumentType(d.documentType),
      previewUrl: this.documentFileUrlService.buildPreviewUrl(d.id),
      downloadUrl: this.documentFileUrlService.buildDownloadUrl(d.id),
    });
  }
}
