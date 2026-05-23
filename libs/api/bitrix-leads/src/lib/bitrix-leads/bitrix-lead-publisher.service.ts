import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';

import { BitrixLeadsApiService } from './bitrix-leads-api.service';
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
  ) {}

  async publishLead(assessmentId: string): Promise<void> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment) {
      throw new Error(`Assessment ${assessmentId} not found`);
    }

    if (assessment.bitrixLeadId) {
      this.logger.log(
        `Assessment ${assessmentId} already published as lead ${assessment.bitrixLeadId}, skipping`,
      );
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: assessment.userId },
    });
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
        const code = error instanceof BitrixApiError ? error.code : 'unknown';
        this.logger.warn(
          `Bitrix retry ${attempt}/3 for assessment=${assessmentId}: ${code}`,
        );
      },
    });

    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { bitrixLeadId: String(leadId) },
    });

    this.logger.log(
      `Bitrix lead published: assessment=${assessmentId}, leadId=${leadId}`,
    );
  }
}
