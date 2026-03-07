import {
  transactionHistoryStatuses,
  transactionHistoryTypes,
  type TransactionHistoryQuery,
  type TransactionHistoryStatus,
  type TransactionHistoryType,
} from '@notary-portal/api-contracts';
import { BadRequestException } from '@nestjs/common';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseTransactionHistoryQuery(
  rawQuery: Record<string, string | string[] | undefined>,
): Required<Pick<TransactionHistoryQuery, 'page' | 'limit'>> & TransactionHistoryQuery {
  const userId = parseOptionalUuid(firstValue(rawQuery['userId']), 'userId');
  const page = parsePositiveInt(firstValue(rawQuery['page']), 1, 'page');
  const limit = parsePositiveInt(firstValue(rawQuery['limit']), 10, 'limit');
  const searchQuery = normalizeSearchQuery(firstValue(rawQuery['searchQuery']));
  const statuses = parseEnumList<TransactionHistoryStatus>(
    rawQuery['statuses'],
    transactionHistoryStatuses,
    'statuses',
  );
  const types = parseEnumList<TransactionHistoryType>(
    rawQuery['types'],
    transactionHistoryTypes,
    'types',
  );
  const dateFrom = parseOptionalDate(firstValue(rawQuery['dateFrom']), 'dateFrom');
  const dateTo = parseOptionalDate(firstValue(rawQuery['dateTo']), 'dateTo');

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new BadRequestException('dateFrom must be earlier than or equal to dateTo');
  }

  return {
    userId,
    page,
    limit,
    searchQuery,
    statuses,
    types,
    dateFrom,
    dateTo,
  };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | undefined, fallback: number, fieldName: string): number {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`${fieldName} must be a positive integer`);
  }

  return parsed;
}

function normalizeSearchQuery(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseOptionalUuid(value: string | undefined, fieldName: string): string | undefined {
  if (!value) return undefined;
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${fieldName} must be a valid UUID`);
  }

  return value;
}

function parseOptionalDate(value: string | undefined, fieldName: string): string | undefined {
  if (!value) return undefined;
  if (!ISO_DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new BadRequestException(`${fieldName} must be an ISO date in YYYY-MM-DD format`);
  }

  return value;
}

function parseEnumList<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fieldName: string,
): T[] | undefined {
  if (!value) return undefined;

  const rawValues = Array.isArray(value) ? value : value.split(',');
  const parsed = rawValues
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean);

  if (parsed.length === 0) return undefined;

  const invalidValues = parsed.filter((item): item is string => !allowed.includes(item as T));
  if (invalidValues.length > 0) {
    throw new BadRequestException(
      `${fieldName} contains unsupported values: ${invalidValues.join(', ')}`,
    );
  }

  return parsed as T[];
}
