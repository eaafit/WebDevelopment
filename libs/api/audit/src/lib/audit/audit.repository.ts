import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import {
  AuditEventSchema,
  ExportAuditEventsResponseSchema,
  ListAuditEventsResponseSchema,
  PaginationMetaSchema,
  UserRole as RpcUserRole,
  type AuditEvent,
  type ExportAuditEventsResponse,
  type ListAuditEventsResponse,
} from '@notary-portal/api-contracts';
import {
  Prisma,
  Role as PrismaRole,
  type AuditLog as PrismaAuditLog,
  type Prisma as PrismaTypes,
} from '@internal/prisma-client';
import type {
  AuditExportQuery,
  AuditFiltersQuery,
  AuditListQuery,
  AuditScope,
} from './audit.query';

type AuditLogRecord = PrismaTypes.AuditLogGetPayload<{
  include: {
    user: true;
  };
}>;

export interface CreateAuditLogInput {
  userId: string;
  actionType: string;
  entityName: string;
  entityId: string;
  details?: Prisma.InputJsonValue;
  timestamp?: Date;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditEvents(query: AuditListQuery): Promise<ListAuditEventsResponse> {
    const where = await this.buildWhere(query.filters, query.scope);
    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: true,
        },
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return create(ListAuditEventsResponseSchema, {
      events: rows.map((row) => this.toAuditEvent(row)),
      meta: create(PaginationMetaSchema, {
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / query.limit)),
        currentPage: query.page,
        perPage: query.limit,
      }),
    });
  }

  async exportAuditEvents(query: AuditExportQuery): Promise<ExportAuditEventsResponse> {
    const where = await this.buildWhere(query.filters, query.scope);
    const rows = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: true,
      },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      ...(query.limit ? { take: query.limit } : {}),
    });

    return create(ExportAuditEventsResponseSchema, {
      events: rows.map((row) => this.toAuditEvent(row)),
    });
  }

  async countAuditEvents(query: AuditExportQuery): Promise<number> {
    const where = await this.buildWhere(query.filters, query.scope);

    return this.prisma.auditLog.count({
      where,
    });
  }

  createAuditLog(input: CreateAuditLogInput): Promise<PrismaAuditLog> {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        actionType: input.actionType,
        entityName: input.entityName,
        entityId: input.entityId,
        details: input.details,
        ...(input.timestamp ? { timestamp: input.timestamp } : {}),
      },
    });
  }

  private async buildWhere(
    filters: AuditFiltersQuery,
    scope: AuditScope,
  ): Promise<Prisma.AuditLogWhereInput> {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.eventType) {
      where.actionType = filters.eventType;
    }

    if (filters.targetId) {
      where.entityId = filters.targetId;
    }

    if (filters.actorUserId) {
      where.userId = filters.actorUserId;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.timestamp = {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      };
    }

    if (filters.actorQuery) {
      where.user = {
        is: {
          OR: [
            {
              fullName: {
                contains: filters.actorQuery,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: filters.actorQuery,
                mode: 'insensitive',
              },
            },
          ],
        },
      };
    }

    if (scope.kind === 'notary') {
      const assessmentIds = await this.findNotaryAssessmentIds(scope.notaryId);
      where.entityName = 'Assessment';
      where.entityId =
        filters.targetId && assessmentIds.includes(filters.targetId)
          ? filters.targetId
          : { in: filters.targetId ? [] : assessmentIds };
    }

    return where;
  }

  private async findNotaryAssessmentIds(notaryId: string): Promise<string[]> {
    const assessments = await this.prisma.assessment.findMany({
      where: {
        notaryId,
      },
      select: {
        id: true,
      },
    });

    return assessments.map((assessment) => assessment.id);
  }

  private toAuditEvent(row: AuditLogRecord): AuditEvent {
    const details = asRecord(row.details);

    return create(AuditEventSchema, {
      id: row.id,
      occurredAt: timestampFromDate(row.timestamp),
      eventType: row.actionType,
      actionTitle: readString(details['actionTitle']) ?? humanizeActionType(row.actionType),
      actionContext: readString(details['actionContext']) ?? '',
      actorUserId: row.userId,
      actorName: row.user.fullName,
      actorEmail: row.user.email,
      actorRole: toRpcUserRole(row.user.role),
      targetType: row.entityName,
      targetId: row.entityId,
      targetTitle: readString(details['targetTitle']) ?? buildTargetTitle(row),
      targetContext: readString(details['targetContext']) ?? buildTargetContext(row),
      ip: readString(details['ip']) ?? '',
      userAgent: readString(details['userAgent']) ?? '',
      beforeJson: stringifyAuditValue(details['before']),
      afterJson: stringifyAuditValue(details['after']),
    });
  }
}

function asRecord(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function readString(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function stringifyAuditValue(value: Prisma.JsonValue | undefined): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function buildTargetTitle(row: AuditLogRecord): string {
  switch (row.entityName) {
    case 'Assessment':
      return `Заявка ${shortId(row.entityId)}`;
    case 'Payment':
      return `Платёж ${shortId(row.entityId)}`;
    case 'Subscription':
      return `Подписка ${shortId(row.entityId)}`;
    default:
      return `${row.entityName} ${shortId(row.entityId)}`;
  }
}

function buildTargetContext(row: AuditLogRecord): string {
  return '';
}

function humanizeActionType(value: string): string {
  switch (value) {
    case 'assessment.created':
      return 'Создана заявка';
    case 'assessment.updated':
      return 'Обновлена заявка';
    case 'assessment.verified':
      return 'Заявка взята в работу';
    case 'assessment.assigned_to_notary':
      return 'Заявка назначена нотариусу';
    case 'assessment.status_in_progress':
      return 'Заявка переведена в работу';
    case 'assessment.completed':
      return 'Заявка завершена';
    case 'assessment.cancelled':
      return 'Заявка отменена';
    case 'payment.created':
      return 'Создан платёж';
    case 'payment.completed':
      return 'Платёж завершён';
    case 'payment.failed':
      return 'Платёж отклонён';
    case 'audit.exported':
      return 'Экспорт аудита';
    default:
      return value;
  }
}

function shortId(value: string): string {
  return value.length > 8 ? `#${value.slice(0, 8)}` : `#${value}`;
}

function toRpcUserRole(role: PrismaRole): RpcUserRole {
  switch (role) {
    case PrismaRole.Admin:
      return RpcUserRole.ADMIN;
    case PrismaRole.Notary:
      return RpcUserRole.NOTARY;
    case PrismaRole.Applicant:
    default:
      return RpcUserRole.APPLICANT;
  }
}
