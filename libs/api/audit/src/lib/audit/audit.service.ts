import { Code, ConnectError } from '@connectrpc/connect';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Injectable, Logger } from '@nestjs/common';
import { Role, getCurrentUser, getRequestMetadata, requireRole } from '@internal/auth-shared';
import type {
  ExportAuditEventsRequest,
  ExportAuditEventsResponse,
  ListAuditEventsRequest,
  ListAuditEventsResponse,
} from '@notary-portal/api-contracts';
import { Prisma } from '@internal/prisma-client';
import { AuditRepository } from './audit.repository';
import type { AuditExportQuery, AuditFiltersQuery, AuditListQuery } from './audit.query';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
const MAX_EXPORT_ROWS = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RecordAuditEventInput {
  actorUserId?: string | null;
  eventType: string;
  targetType: string;
  targetId: string;
  actionTitle: string;
  actionContext?: string;
  targetTitle?: string;
  targetContext?: string;
  before?: Prisma.JsonValue;
  after?: Prisma.JsonValue;
  timestamp?: Date;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditRepository: AuditRepository) {}

  listAuditEvents(request: ListAuditEventsRequest): Promise<ListAuditEventsResponse> {
    return this.auditRepository.listAuditEvents(this.normalizeListRequest(request));
  }

  async exportAuditEvents(request: ExportAuditEventsRequest): Promise<ExportAuditEventsResponse> {
    const query = this.normalizeExportRequest(request);
    const totalRows = await this.auditRepository.countAuditEvents(query);

    if (totalRows > MAX_EXPORT_ROWS) {
      throw new ConnectError(
        `Export matches ${totalRows} audit events, maximum is ${MAX_EXPORT_ROWS}. Narrow filters and try again.`,
        Code.ResourceExhausted,
      );
    }

    const response = await this.auditRepository.exportAuditEvents({
      ...query,
      limit: MAX_EXPORT_ROWS + 1,
    });

    if (response.events.length > MAX_EXPORT_ROWS) {
      throw new ConnectError(
        `Export returned more than ${MAX_EXPORT_ROWS} audit events. Narrow filters and try again.`,
        Code.ResourceExhausted,
      );
    }

    const actorUserId = getCurrentUser()?.sub ?? null;

    if (actorUserId) {
      const exportTarget = buildExportAuditTarget(query, actorUserId);

      await this.record({
        actorUserId,
        eventType: 'audit.exported',
        targetType: exportTarget.targetType,
        targetId: exportTarget.targetId,
        actionTitle: 'Экспорт аудита',
        actionContext: `Экспортировано строк: ${response.events.length}`,
        targetTitle: exportTarget.targetTitle,
        targetContext: exportTarget.targetContext,
        after: {
          filters: serializeFilters(query.filters),
          exportedRows: response.events.length,
        },
      });
    }

    return response;
  }

  async record(input: RecordAuditEventInput): Promise<void> {
    const currentUser = getCurrentUser();
    const metadata = getRequestMetadata();
    const actorUserId = input.actorUserId ?? currentUser?.sub ?? null;

    if (!actorUserId) {
      return;
    }

    const details = compactJson({
      actionTitle: input.actionTitle,
      actionContext: input.actionContext,
      targetTitle: input.targetTitle,
      targetContext: input.targetContext,
      before: input.before,
      after: input.after,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
    });

    try {
      await this.auditRepository.createAuditLog({
        userId: actorUserId,
        actionType: input.eventType,
        entityName: input.targetType,
        entityId: input.targetId,
        details,
        timestamp: input.timestamp,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record audit event ${input.eventType} for ${input.targetType}:${input.targetId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private normalizeListRequest(request: ListAuditEventsRequest): AuditListQuery {
    const user = requireRole(Role.Admin, Role.Notary);
    const filters = this.normalizeFilters(request.filters);

    return {
      page: normalizePositiveInt(request.pagination?.page, DEFAULT_PAGE),
      limit: normalizePageLimit(request.pagination?.limit),
      filters,
      scope: isNotaryRole(user.role)
        ? {
            kind: 'notary',
            notaryId: user.sub,
          }
        : {
            kind: 'admin',
          },
    };
  }

  private normalizeExportRequest(request: ExportAuditEventsRequest): AuditExportQuery {
    const user = requireRole(Role.Admin, Role.Notary);

    return {
      filters: this.normalizeFilters(request.filters),
      scope: isNotaryRole(user.role)
        ? {
            kind: 'notary',
            notaryId: user.sub,
          }
        : {
            kind: 'admin',
          },
    };
  }

  private normalizeFilters(
    filters: ListAuditEventsRequest['filters'] | ExportAuditEventsRequest['filters'],
  ): AuditFiltersQuery {
    const eventType = normalizeOptionalString(filters?.eventType);
    const actorQuery = normalizeOptionalString(filters?.actorQuery);
    const actorUserId = normalizeOptionalUuid(filters?.actorUserId, 'filters.actorUserId');
    const targetId = normalizeOptionalUuid(filters?.targetId, 'filters.targetId');
    const dateFrom = filters?.dateRange?.startDate
      ? timestampDate(filters.dateRange.startDate)
      : undefined;
    const dateTo = filters?.dateRange?.endDate
      ? timestampDate(filters.dateRange.endDate)
      : undefined;

    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new ConnectError(
        'filters.dateRange start_date must be earlier than end_date',
        Code.InvalidArgument,
      );
    }

    return {
      eventType,
      actorQuery,
      actorUserId,
      targetId,
      dateFrom,
      dateTo,
    };
  }
}

function normalizePageLimit(value: number | undefined): number {
  const limit = normalizePositiveInt(value, DEFAULT_LIMIT);

  if (limit > MAX_PAGE_LIMIT) {
    throw new ConnectError(
      `pagination.limit must not exceed ${MAX_PAGE_LIMIT}`,
      Code.InvalidArgument,
    );
  }

  return limit;
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (value === undefined || value === 0) {
    return fallback;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new ConnectError(
      'pagination page and limit must be positive integers',
      Code.InvalidArgument,
    );
  }

  return value;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalUuid(value: string | undefined, field: string): string | undefined {
  if (!value) {
    return undefined;
  }

  if (!UUID_PATTERN.test(value)) {
    throw new ConnectError(`${field} must be a valid UUID`, Code.InvalidArgument);
  }

  return value;
}

function isNotaryRole(role: string): boolean {
  return role === '2' || role === Role.Notary;
}

function compactJson(
  value: Record<string, Prisma.JsonValue | null | undefined>,
): Prisma.InputJsonValue {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) => entry !== undefined && entry !== null && entry !== '',
    ),
  ) as Prisma.InputJsonValue;
}

function serializeFilters(filters: AuditFiltersQuery): Prisma.JsonObject {
  return compactJson({
    eventType: filters.eventType,
    actorQuery: filters.actorQuery,
    actorUserId: filters.actorUserId,
    targetId: filters.targetId,
    dateFrom: filters.dateFrom?.toISOString(),
    dateTo: filters.dateTo?.toISOString(),
  }) as Prisma.JsonObject;
}

function buildExportAuditTarget(
  query: AuditExportQuery,
  actorUserId: string,
): {
  targetType: string;
  targetId: string;
  targetTitle: string;
  targetContext: string;
} {
  if (query.filters.targetId) {
    return {
      targetType: 'Assessment',
      targetId: query.filters.targetId,
      targetTitle: `Заявка #${query.filters.targetId.slice(0, 8)}`,
      targetContext: 'CSV экспорт аудита по заявке',
    };
  }

  return {
    targetType: 'AuditLog',
    targetId: actorUserId,
    targetTitle: 'CSV экспорт аудита',
    targetContext:
      query.scope.kind === 'notary' ? 'События по заявкам нотариуса' : 'Все события аудита',
  };
}
