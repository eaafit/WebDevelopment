export interface AuditFiltersQuery {
  eventType?: string;
  actorQuery?: string;
  actorUserId?: string;
  targetId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export type AuditScope =
  | {
      kind: 'admin';
    }
  | {
      kind: 'notary';
      notaryId: string;
    };

export interface AuditListQuery {
  page: number;
  limit: number;
  filters: AuditFiltersQuery;
  scope: AuditScope;
}

export interface AuditExportQuery {
  filters: AuditFiltersQuery;
  scope: AuditScope;
  limit?: number;
}
