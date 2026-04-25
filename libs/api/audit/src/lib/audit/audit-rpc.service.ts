import { Injectable } from '@nestjs/common';
import type {
  ExportAuditEventsRequest,
  ExportAuditEventsResponse,
  ListAuditEventsRequest,
  ListAuditEventsResponse,
} from '@notary-portal/api-contracts';
import { AuditService } from './audit.service';

@Injectable()
export class AuditRpcService {
  constructor(private readonly auditService: AuditService) {}

  readonly listAuditEvents = (request: ListAuditEventsRequest): Promise<ListAuditEventsResponse> =>
    this.auditService.listAuditEvents(request);

  readonly exportAuditEvents = (
    request: ExportAuditEventsRequest,
  ): Promise<ExportAuditEventsResponse> => this.auditService.exportAuditEvents(request);
}
