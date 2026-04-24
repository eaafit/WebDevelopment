import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  AuditService,
  UserRole,
  type AuditEvent,
  type ExportAuditEventsResponse,
  type ListAuditEventsResponse,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { from, map, type Observable } from 'rxjs';
import { RPC_TRANSPORT } from '../rpc/rpc-transport';
import type {
  AuditMonitoringEvent,
  AuditMonitoringFilters,
  AuditMonitoringPageResult,
  AuditMonitoringQuery,
} from './audit-monitoring.models';

@Injectable({ providedIn: 'root' })
export class AuditMonitoringApiService {
  private readonly client = createClient(AuditService, inject(RPC_TRANSPORT));

  getAuditEvents(query: AuditMonitoringQuery): Observable<AuditMonitoringPageResult> {
    return from(this.client.listAuditEvents(buildListRequest(query))).pipe(
      map((response) => this.toPageResult(response)),
    );
  }

  exportAuditEvents(filters: AuditMonitoringFilters): Observable<AuditMonitoringEvent[]> {
    return from(this.client.exportAuditEvents(buildExportRequest(filters))).pipe(
      map((response) => this.toEvents(response)),
    );
  }

  private toPageResult(response: ListAuditEventsResponse): AuditMonitoringPageResult {
    return {
      events: this.toEvents(response),
      meta: response.meta
        ? {
            totalItems: response.meta.totalItems,
            totalPages: response.meta.totalPages,
            currentPage: response.meta.currentPage,
            perPage: response.meta.perPage,
          }
        : null,
    };
  }

  private toEvents(
    response: ListAuditEventsResponse | ExportAuditEventsResponse,
  ): AuditMonitoringEvent[] {
    return response.events.map((event) => this.toEventItem(event));
  }

  private toEventItem(event: AuditEvent): AuditMonitoringEvent {
    return {
      id: event.id,
      occurredAt: event.occurredAt ? timestampDate(event.occurredAt).toISOString() : '',
      eventType: event.eventType,
      actionTitle: event.actionTitle,
      actionContext: event.actionContext,
      actorUserId: event.actorUserId,
      actorName: event.actorName,
      actorEmail: event.actorEmail,
      actorRoleLabel: roleLabel(event.actorRole),
      targetType: event.targetType,
      targetId: event.targetId,
      targetTitle: event.targetTitle,
      targetContext: event.targetContext,
      ip: event.ip,
      userAgent: event.userAgent,
      beforeJson: event.beforeJson,
      afterJson: event.afterJson,
    };
  }
}

function buildListRequest(query: AuditMonitoringQuery) {
  return {
    pagination: {
      page: query.page,
      limit: query.limit,
    },
    filters: buildFilters(query),
  };
}

function buildExportRequest(filters: AuditMonitoringFilters) {
  return {
    filters: buildFilters(filters),
  };
}

function buildFilters(filters: AuditMonitoringFilters) {
  const dateRange =
    filters.dateFrom || filters.dateTo
      ? {
          startDate: filters.dateFrom ? toUtcBoundary(filters.dateFrom, 'start') : undefined,
          endDate: filters.dateTo ? toUtcBoundary(filters.dateTo, 'end') : undefined,
        }
      : undefined;

  return {
    eventType: filters.eventType.trim(),
    actorQuery: filters.actorQuery.trim(),
    actorUserId: filters.actorUserId.trim(),
    targetId: filters.targetId.trim(),
    assessmentId: filters.assessmentId.trim(),
    dateRange,
  };
}

function toUtcBoundary(value: string, edge: 'start' | 'end') {
  const suffix = edge === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
  return timestampFromDate(new Date(`${value}${suffix}`));
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return 'Администратор';
    case UserRole.NOTARY:
      return 'Нотариус';
    case UserRole.APPLICANT:
    default:
      return 'Заявитель';
  }
}
