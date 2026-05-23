import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';

import { BitrixLeadsApiService } from './bitrix-leads-api.service';
import { buildLeadFields } from './bitrix-lead.mapper';

/**
 * Оркестратор публикации заявки (Assessment) в Bitrix24 как лида.
 *
 * Идемпотентность: повторный вызов на уже-опубликованную заявку
 * (Assessment.bitrixLeadId не null) — пропуск без ошибки.
 *
 * Поведение при ошибках:
 *   - Assessment / User не найдены в БД → бросает обычный Error (не Bitrix-проблема)
 *   - Bitrix-ошибки — пробрасываются наружу (Фаза 5.2 добавит retry для recoverable)
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

    const fields = buildLeadFields(assessment, user);
    const leadId = await this.api.createLead(fields);

    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { bitrixLeadId: String(leadId) },
    });

    this.logger.log(
      `Bitrix lead published: assessment=${assessmentId}, leadId=${leadId}`,
    );
  }
}
