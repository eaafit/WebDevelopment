export type AuditMonitoringMode = 'admin' | 'notary';

export interface AuditMonitoringFilters {
  eventType: string;
  actorQuery: string;
  actorUserId: string;
  targetId: string;
  dateFrom: string;
  dateTo: string;
}

export interface AuditMonitoringMeta {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  perPage: number;
}

export interface AuditMonitoringEvent {
  id: string;
  occurredAt: string;
  eventType: string;
  actionTitle: string;
  actionContext: string;
  actorUserId: string;
  actorName: string;
  actorEmail: string;
  actorRoleLabel: string;
  targetType: string;
  targetId: string;
  targetTitle: string;
  targetContext: string;
  ip: string;
  userAgent: string;
  beforeJson: string;
  afterJson: string;
}

export interface AuditMonitoringPageResult {
  events: AuditMonitoringEvent[];
  meta: AuditMonitoringMeta | null;
}

export interface AuditMonitoringQuery extends AuditMonitoringFilters {
  page: number;
  limit: number;
}
