import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { PrismaService } from '@internal/prisma';
import { Injectable } from '@nestjs/common';
import {
  AssessmentReportSchema,
  ListReportsResponseSchema,
  GetReportResponseSchema,
  PaginationMetaSchema,
  ReportStatus as RpcReportStatus,
  type AssessmentReport as RpcReport,
  type GetReportResponse,
  type ListReportsResponse,
} from '@notary-portal/api-contracts';
import { ReportStatus as PrismaReportStatus, type Prisma } from '@internal/prisma-client';
import type { ReportQuery } from './report.query';

@Injectable()
export class ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List ───────────────────────────────────────────────────

  async listReports(query: ReportQuery): Promise<ListReportsResponse> {
    const { page, limit } = query;
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query);

    const [totalItems, reports] = await this.prisma.$transaction([
      this.prisma.assessmentReport.count({ where }),
      this.prisma.assessmentReport.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return create(ListReportsResponseSchema, {
      reports: reports.map((r) => this.toMessage(r)),
      meta: create(PaginationMetaSchema, {
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
        perPage: limit,
      }),
    });
  }

  // ─── Get ────────────────────────────────────────────────────

  async getReport(id: string): Promise<GetReportResponse> {
    const report = await this.prisma.assessmentReport.findUniqueOrThrow({ where: { id } });
    return create(GetReportResponseSchema, { report: this.toMessage(report) });
  }

  // ─── Create ─────────────────────────────────────────────────

  async createReport(data: {
    assessmentId: string;
    reportPath: string;
    signedById: string;
  }): Promise<RpcReport> {
    const lastVersion = await this.prisma.assessmentReport.findFirst({
      where: { assessmentId: data.assessmentId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const report = await this.prisma.assessmentReport.create({
      data: {
        assessmentId: data.assessmentId,
        reportPath:   data.reportPath,
        signedById:   data.signedById,
        version:      (lastVersion?.version ?? 0) + 1,
        status:       PrismaReportStatus.Draft,
      },
    });

    return this.toMessage(report);
  }

  // ─── Sign ───────────────────────────────────────────────────

  async signReport(id: string, signatureData: Uint8Array): Promise<RpcReport> {
    const report = await this.prisma.assessmentReport.update({
      where: { id },
      data: {
        signatureData: new Uint8Array(signatureData),
        status: PrismaReportStatus.Signed,
      },
    });
    return this.toMessage(report);
  }

  // ─── Delete ─────────────────────────────────────────────────

  async deleteReport(id: string): Promise<boolean> {
    await this.prisma.assessmentReport.delete({ where: { id } });
    return true;
  }

  // ─── Private helpers ────────────────────────────────────────

  private buildWhere(query: ReportQuery): Prisma.AssessmentReportWhereInput {
    const where: Prisma.AssessmentReportWhereInput = {};
    if (query.assessmentId) where.assessmentId = query.assessmentId;
    if (query.signedById)   where.signedById   = query.signedById;
    if (query.status)       where.status       = this.toPrismaStatus(query.status);
    return where;
  }

  private buildOrderBy(
    query: ReportQuery,
  ): Prisma.AssessmentReportOrderByWithRelationInput {
    const dir = query.sortDesc ? 'desc' : 'asc';
    return query.sortField === 'version'
      ? { version: dir }
      : { generatedAt: 'desc' };
  }

  private toMessage(r: {
    id: string;
    assessmentId: string;
    reportPath: string;
    generatedAt: Date;
    signedById: string;
    signatureData: Buffer | Uint8Array | null;
    version: number;
    status: PrismaReportStatus;
  }): RpcReport {
    return create(AssessmentReportSchema, {
      id:           r.id,
      assessmentId: r.assessmentId,
      reportPath:   r.reportPath,
      generatedAt:  timestampFromDate(r.generatedAt),
      signedById:   r.signedById,
      version:      r.version,
      hasSignature: !!r.signatureData,
      status:       this.fromPrismaStatus(r.status),
    });
  }

  private toPrismaStatus(s: RpcReportStatus): PrismaReportStatus {
    return s === RpcReportStatus.SIGNED
      ? PrismaReportStatus.Signed
      : PrismaReportStatus.Draft;
  }

  private fromPrismaStatus(s: PrismaReportStatus): RpcReportStatus {
    return s === PrismaReportStatus.Signed
      ? RpcReportStatus.SIGNED
      : RpcReportStatus.DRAFT;
  }
}
