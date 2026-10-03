import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuditMonitoringApiService } from '../audit-monitoring/audit-monitoring-api.service';
import type { UiAuditNotificationSource } from './notification.models';

/** ЛР6: события аудита через AuditService для сверки с in-app уведомлениями. */
@Injectable({ providedIn: 'root' })
export class NotificationAuditSourceService {
  private readonly auditApi = inject(AuditMonitoringApiService);

  async listAssessmentCreated(limit = 10): Promise<UiAuditNotificationSource[]> {
    return this.listAccountEvents({ limit, eventType: 'assessment.created' });
  }

  async listAccountEvents(params?: {
    limit?: number;
    eventType?: string;
  }): Promise<UiAuditNotificationSource[]> {
    const page = await firstValueFrom(
      this.auditApi.getAuditEvents({
        page: 1,
        limit: params?.limit ?? 20,
        eventType: params?.eventType ?? '',
        actorQuery: '',
        actorUserId: '',
        targetId: '',
        dateFrom: '',
        dateTo: '',
      }),
    );

    return page.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      actionTitle: event.actionTitle,
      actionContext: event.actionContext,
      targetTitle: event.targetTitle,
      targetContext: event.targetContext,
      occurredAt: event.occurredAt,
    }));
  }
}
