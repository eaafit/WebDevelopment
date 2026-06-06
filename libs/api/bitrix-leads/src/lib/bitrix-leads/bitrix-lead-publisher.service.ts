import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import {
  BusinessOperations,
  NotarySpanAttributes,
  runInSpan,
  setSpanAttributes,
} from '@internal/tracing';

import { BitrixLeadsApiService } from './bitrix-leads-api.service';
import { BitrixLeadsConfigService } from './bitrix-leads-config.service';
import { buildLeadFields } from './bitrix-lead.mapper';
import {
  BitrixApiError,
  BitrixRateLimitError,
  BitrixUnavailableError,
} from './bitrix-leads.errors';
import { retryWithBackoff } from './bitrix-leads-retry.helper';

/**
 * Оркестратор публикации заявки (Assessment) в Bitrix24 как лида.
 *
 * Идемпотентность: повторный вызов на уже-опубликованную заявку
 * (Assessment.bitrixLeadId не null) — пропуск без ошибки.
 *
 * Поведение при ошибках:
 *   - Bitrix не сконфигурирован (нет env) → лог + return (тихий пропуск, не ошибка)
 *   - Assessment / User не найдены в БД → бросает обычный Error (не Bitrix-проблема)
 *   - BitrixUnavailableError / BitrixRateLimitError — retry с экспоненциальным backoff (3 попытки)
 *   - BitrixAuthError / BitrixValidationError / BitrixUnknownError — сразу пробрасывается
 */
@Injectable()
export class BitrixLeadPublisherService {
  private readonly logger = new Logger(BitrixLeadPublisherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: BitrixLeadsApiService,
    private readonly config: BitrixLeadsConfigService,
  ) {}

  async publishLead(assessmentId: string): Promise<void> {
    return runInSpan(
      'BitrixLeadPublisherService.publishLead',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixLeadPublish,
        [NotarySpanAttributes.entity]: 'BitrixLead',
      },
      async (span) => {
        const configured = this.config.isConfigured();
        setSpanAttributes(span, { 'bitrix.configured': configured });
        if (!configured) {
          this.logger.log(
            'Bitrix lead publish skipped; operation=bitrix.lead.publish; result=not_configured',
          );
          return;
        }

        const assessment = await runInSpan(
          'Prisma.assessment.findUnique bitrix lead publish',
          {
            [NotarySpanAttributes.operation]: BusinessOperations.bitrixLeadAssessmentLookup,
            [NotarySpanAttributes.entity]: 'Assessment',
            'db.operation': 'select',
          },
          () =>
            this.prisma.assessment.findUnique({
              where: { id: assessmentId },
            }),
        );
        if (!assessment) {
          throw new Error(`Assessment ${assessmentId} not found`);
        }

        setSpanAttributes(span, {
          'bitrix.lead.already_published': Boolean(assessment.bitrixLeadId),
          'assessment.status': assessment.status,
          'assessment.has_estimated_value': Boolean(assessment.estimatedValue),
        });
        if (assessment.bitrixLeadId) {
          this.logger.log(
            'Bitrix lead publish skipped; operation=bitrix.lead.publish; result=already_published',
          );
          return;
        }

        const user = await runInSpan(
          'Prisma.user.findUnique bitrix lead publish',
          {
            [NotarySpanAttributes.operation]: BusinessOperations.bitrixLeadUserLookup,
            [NotarySpanAttributes.entity]: 'User',
            'db.operation': 'select',
          },
          () =>
            this.prisma.user.findUnique({
              where: { id: assessment.userId },
            }),
        );
        if (!user) {
          throw new Error(`User ${assessment.userId} not found`);
        }

        // Prisma возвращает estimatedValue как Decimal-инстанс — приводим к строке,
        // чтобы маппер оставался независимым от Prisma runtime типов.
        const fields = buildLeadFields(
          {
            ...assessment,
            estimatedValue: assessment.estimatedValue?.toString() ?? null,
          },
          user,
        );

        const leadId = await retryWithBackoff(() => this.api.createLead(fields), {
          isRetriable: (error) =>
            error instanceof BitrixUnavailableError || error instanceof BitrixRateLimitError,
          onRetry: (attempt, error) => {
            setSpanAttributes(span, { 'bitrix.retry.attempt': attempt });
            const code = error instanceof BitrixApiError ? error.code : 'unknown';
            this.logger.warn(
              `Bitrix lead publish retry; operation=bitrix.lead.publish; result=retry; attempt=${attempt}; code=${code}`,
            );
          },
        });

        await runInSpan(
          'Prisma.assessment.update bitrix lead id',
          {
            [NotarySpanAttributes.operation]: BusinessOperations.bitrixLeadPersistExternalId,
            [NotarySpanAttributes.entity]: 'Assessment',
            'db.operation': 'update',
          },
          () =>
            this.prisma.assessment.update({
              where: { id: assessmentId },
              data: { bitrixLeadId: String(leadId) },
            }),
        );

        setSpanAttributes(span, { 'bitrix.lead.created': true });
        this.logger.log('Bitrix lead published; operation=bitrix.lead.publish; result=success');
      },
    );
  }
}
