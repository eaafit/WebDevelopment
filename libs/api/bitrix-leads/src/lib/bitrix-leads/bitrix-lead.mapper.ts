import type { LeadFields } from './bitrix-leads.types';

// Локальные input-типы декларируют минимум, который маппер реально использует.
// Полные Prisma User / Assessment удовлетворят им через structural typing —
// не импортируем @internal/prisma-client, чтобы маппер оставался pure и тестируемым.

export interface UserLike {
  fullName: string;
  email: string;
  phoneNumber?: string | null;
}

export interface AssessmentLike {
  id: string;
  address: string;
  description?: string | null;
  // Prisma возвращает Decimal как объект с .toString(); в snapshot-слое уже строка.
  // Принимаем оба варианта плюс число (для тестов и удобства вызывающего кода).
  estimatedValue?: string | number | null;
}

// Bitrix-константы для лидов, созданных в момент новой заявки на оценку
const CURRENCY_RUB = 'RUB';
const SOURCE_WEB = 'WEB';
const STATUS_NEW = 'NEW';

/**
 * Преобразует пару Assessment + User в формат полей Bitrix Lead.
 * Pure function — без side effects, без DI, без работы с БД/сетью.
 * Опциональные поля (PHONE, COMMENTS, OPPORTUNITY и т.п.) НЕ добавляются,
 * если входные данные null/пустые — Bitrix создаст лид без них.
 */
export function buildLeadFields(
  assessment: AssessmentLike,
  user: UserLike,
): LeadFields {
  const fields: LeadFields = {
    TITLE: buildTitle(assessment),
    UF_CRM_ASSESSMENT_ID: assessment.id,
    EMAIL: [{ VALUE: user.email, VALUE_TYPE: 'WORK' }],
    CURRENCY_ID: CURRENCY_RUB,
    SOURCE_ID: SOURCE_WEB,
    STATUS_ID: STATUS_NEW,
  };

  // ФИО — разбираем fullName по пробелам, отбрасываем пустые сегменты
  const parts = user.fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 1) fields.LAST_NAME = parts[0];
  if (parts.length >= 2) fields.NAME = parts[1];
  if (parts.length >= 3) fields.SECOND_NAME = parts.slice(2).join(' ');

  // Телефон опциональный — добавляем только если непустой после trim
  const phone = user.phoneNumber?.trim();
  if (phone) {
    fields.PHONE = [{ VALUE: phone, VALUE_TYPE: 'WORK' }];
  }

  // Адрес: schema гарантирует not-null, но защитимся от пустой строки
  const address = assessment.address.trim();
  if (address) {
    fields.ADDRESS = address;
  }

  // Комментарии — опциональные
  const description = assessment.description?.trim();
  if (description) {
    fields.COMMENTS = description;
  }

  // Сумма оценки
  const opportunity = parseOpportunity(assessment.estimatedValue);
  if (opportunity !== null) {
    fields.OPPORTUNITY = opportunity;
  }

  return fields;
}

function buildTitle(assessment: AssessmentLike): string {
  const shortId = assessment.id.substring(0, 8);
  const address = assessment.address.trim();
  return address ? `Заявка ${shortId} — ${address}` : `Заявка ${shortId}`;
}

function parseOpportunity(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}
