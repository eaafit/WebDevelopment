import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { PrismaService } from '@internal/prisma';
import { Injectable } from '@nestjs/common';
import {
  DocumentSchema,
  DocumentType as RpcDocumentType,
  GetDocumentResponseSchema,
  ListDocumentsResponseSchema,
  PaginationMetaSchema,
  type Document as RpcDocument,
  type GetDocumentResponse,
  type ListDocumentsResponse,
} from '@notary-portal/api-contracts';
import { DocumentType as PrismaDocumentType, type Prisma } from '@internal/prisma-client';
import type { DocumentQuery } from './document.query';

@Injectable()
export class DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listDocuments(query: DocumentQuery): Promise<ListDocumentsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query);

    const [totalItems, documents] = await this.prisma.$transaction([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
    ]);

    return create(ListDocumentsResponseSchema, {
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
    const document = await this.prisma.document.findUniqueOrThrow({ where: { id } });
    return create(GetDocumentResponseSchema, { document: this.toMessage(document) });
  }

  async createDocument(data: {
    assessmentId: string;
    fileName: string;
    fileType: string;
    documentType: PrismaDocumentType;
    filePath: string;
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
        documentType: data.documentType,
        filePath: data.filePath,
        uploadedById: data.uploadedById,
        version: (lastVersion?.version ?? 0) + 1,
      },
    });

    return this.toMessage(document);
  }

  async deleteDocument(id: string): Promise<boolean> {
    await this.prisma.document.delete({ where: { id } });
    return true;
  }

  private buildWhere(query: DocumentQuery): Prisma.DocumentWhereInput {
    const where: Prisma.DocumentWhereInput = {};
    if (query.assessmentId) where.assessmentId = query.assessmentId;
    if (query.uploadedById) where.uploadedById = query.uploadedById;
    if (query.documentType) where.documentType = this.toPrismaType(query.documentType);
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
    documentType: PrismaDocumentType;
    filePath: string;
    version: number;
    uploadedAt: Date;
    uploadedById: string;
  }): RpcDocument {
    return create(DocumentSchema, {
      id: d.id,
      assessmentId: d.assessmentId,
      fileName: d.fileName,
      fileType: d.fileType,
      documentType: this.fromPrismaType(d.documentType),
      filePath: d.filePath,
      version: d.version,
      uploadedAt: timestampFromDate(d.uploadedAt),
      uploadedById: d.uploadedById,
    });
  }

  private toPrismaType(t: RpcDocumentType): PrismaDocumentType {
    const map: Partial<Record<RpcDocumentType, PrismaDocumentType>> = {
      [RpcDocumentType.DOCUMENT_TYPE_PASSPORT]: PrismaDocumentType.Passport,
      [RpcDocumentType.DOCUMENT_TYPE_PROPERTY_DEED]: PrismaDocumentType.PropertyDeed,
      [RpcDocumentType.DOCUMENT_TYPE_TECHNICAL_PLAN]: PrismaDocumentType.TechnicalPlan,
      [RpcDocumentType.DOCUMENT_TYPE_CADASTRAL_PASSPORT]: PrismaDocumentType.CadastralPassport,
      [RpcDocumentType.DOCUMENT_TYPE_PHOTO]: PrismaDocumentType.Photo,
      [RpcDocumentType.DOCUMENT_TYPE_OTHER]: PrismaDocumentType.Other,
    };
    return map[t] ?? PrismaDocumentType.Other;
  }

  private fromPrismaType(t: PrismaDocumentType): RpcDocumentType {
    const map: Record<PrismaDocumentType, RpcDocumentType> = {
      [PrismaDocumentType.Passport]: RpcDocumentType.DOCUMENT_TYPE_PASSPORT,
      [PrismaDocumentType.PropertyDeed]: RpcDocumentType.DOCUMENT_TYPE_PROPERTY_DEED,
      [PrismaDocumentType.TechnicalPlan]: RpcDocumentType.DOCUMENT_TYPE_TECHNICAL_PLAN,
      [PrismaDocumentType.CadastralPassport]: RpcDocumentType.DOCUMENT_TYPE_CADASTRAL_PASSPORT,
      [PrismaDocumentType.Photo]: RpcDocumentType.DOCUMENT_TYPE_PHOTO,
      [PrismaDocumentType.Other]: RpcDocumentType.DOCUMENT_TYPE_OTHER,
    };
    return map[t];
  }
}
