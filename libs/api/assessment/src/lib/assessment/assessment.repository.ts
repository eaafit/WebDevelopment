import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { PrismaService } from '@internal/prisma';
import { Injectable } from '@nestjs/common';
import {
  AssessmentSchema,
  AssessmentStatus as RpcAssessmentStatus,
  GetAssessmentResponseSchema,
  ListAssessmentsResponseSchema,
  PaginationMetaSchema,
  type Assessment as RpcAssessment,
  type GetAssessmentResponse,
  type ListAssessmentsResponse,
} from '@notary-portal/api-contracts';
import { AssessmentStatus as PrismaAssessmentStatus, type Prisma } from '@internal/prisma-client';
import type { AssessmentQuery } from './assessment.query';

@Injectable()
export class AssessmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listAssessments(query: AssessmentQuery): Promise<ListAssessmentsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query);

    const [totalItems, assessments] = await this.prisma.$transaction([
      this.prisma.assessment.count({ where }),
      this.prisma.assessment.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return create(ListAssessmentsResponseSchema, {
      assessments: assessments.map((a) => this.toMessage(a)),
      meta: create(PaginationMetaSchema, {
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
        perPage: limit,
      }),
    });
  }

  async getAssessment(id: string): Promise<GetAssessmentResponse> {
    const assessment = await this.prisma.assessment.findUniqueOrThrow({ where: { id } });
    return create(GetAssessmentResponseSchema, { assessment: this.toMessage(assessment) });
  }

  async createAssessment(data: {
    userId: string;
    address: string;
    description?: string;
  }): Promise<RpcAssessment> {
    const assessment = await this.prisma.assessment.create({
      data: {
        userId: data.userId,
        address: data.address,
        description: data.description,
      },
    });
    return this.toMessage(assessment);
  }

  async updateAssessment(
    id: string,
    data: {
      address?: string;
      description?: string;
    },
  ): Promise<RpcAssessment> {
    const assessment = await this.prisma.assessment.update({
      where: { id },
      data: {
        ...(data.address && { address: data.address }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });
    return this.toMessage(assessment);
  }

  async verifyAssessment(id: string, notaryId: string): Promise<RpcAssessment> {
    const assessment = await this.prisma.assessment.update({
      where: { id },
      data: { status: PrismaAssessmentStatus.Verified, notaryId },
    });
    return this.toMessage(assessment);
  }

  async completeAssessment(id: string, estimatedValue: string): Promise<RpcAssessment> {
    const assessment = await this.prisma.assessment.update({
      where: { id },
      data: { status: PrismaAssessmentStatus.Completed, estimatedValue },
    });
    return this.toMessage(assessment);
  }

  async cancelAssessment(id: string, reason?: string): Promise<RpcAssessment> {
    const assessment = await this.prisma.assessment.update({
      where: { id },
      data: { status: PrismaAssessmentStatus.Cancelled, cancelReason: reason },
    });
    return this.toMessage(assessment);
  }

  private buildWhere(query: AssessmentQuery): Prisma.AssessmentWhereInput {
    const where: Prisma.AssessmentWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.notaryId) where.notaryId = query.notaryId;
    if (query.status) where.status = this.toPrismaStatus(query.status);
    if (query.createdAtFrom || query.createdAtTo) {
      where.createdAt = {
        ...(query.createdAtFrom && { gte: query.createdAtFrom }),
        ...(query.createdAtTo && { lte: query.createdAtTo }),
      };
    }
    return where;
  }

  private buildOrderBy(query: AssessmentQuery): Prisma.AssessmentOrderByWithRelationInput {
    const direction = query.sortDesc ? 'desc' : 'asc';
    switch (query.sortField) {
      case 'estimatedValue':
        return { estimatedValue: direction };
      case 'updatedAt':
        return { updatedAt: direction };
      default:
        return { createdAt: 'desc' };
    }
  }

  private toMessage(a: {
    id: string;
    userId: string;
    notaryId?: string | null;
    status: PrismaAssessmentStatus;
    address: string;
    description?: string | null;
    estimatedValue?: import('@prisma/client/runtime/library').Decimal | null;
    cancelReason?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): RpcAssessment {
    return create(AssessmentSchema, {
      id: a.id,
      userId: a.userId,
      notaryId: a.notaryId ?? '',
      status: this.fromPrismaStatus(a.status),
      address: a.address,
      description: a.description ?? '',
      estimatedValue: a.estimatedValue?.toString() ?? '',
      cancelReason: a.cancelReason ?? '',
      createdAt: timestampFromDate(a.createdAt),
      updatedAt: timestampFromDate(a.updatedAt),
    });
  }

  private toPrismaStatus(status: RpcAssessmentStatus): PrismaAssessmentStatus {
    const map: Record<number, PrismaAssessmentStatus> = {
      [RpcAssessmentStatus.ASSESSMENT_STATUS_NEW]: PrismaAssessmentStatus.New,
      [RpcAssessmentStatus.ASSESSMENT_STATUS_VERIFIED]: PrismaAssessmentStatus.Verified,
      [RpcAssessmentStatus.ASSESSMENT_STATUS_IN_PROGRESS]: PrismaAssessmentStatus.InProgress,
      [RpcAssessmentStatus.ASSESSMENT_STATUS_COMPLETED]: PrismaAssessmentStatus.Completed,
      [RpcAssessmentStatus.ASSESSMENT_STATUS_CANCELLED]: PrismaAssessmentStatus.Cancelled,
    };
    const result = map[status];
    if (!result) throw new Error(`Unsupported assessment status: ${status}`);
    return result;
  }

  private fromPrismaStatus(status: PrismaAssessmentStatus): RpcAssessmentStatus {
    const map: Record<PrismaAssessmentStatus, RpcAssessmentStatus> = {
      [PrismaAssessmentStatus.New]: RpcAssessmentStatus.ASSESSMENT_STATUS_NEW,
      [PrismaAssessmentStatus.Verified]: RpcAssessmentStatus.ASSESSMENT_STATUS_VERIFIED,
      [PrismaAssessmentStatus.InProgress]: RpcAssessmentStatus.ASSESSMENT_STATUS_IN_PROGRESS,
      [PrismaAssessmentStatus.Completed]: RpcAssessmentStatus.ASSESSMENT_STATUS_COMPLETED,
      [PrismaAssessmentStatus.Cancelled]: RpcAssessmentStatus.ASSESSMENT_STATUS_CANCELLED,
    };
    return map[status];
  }
}
