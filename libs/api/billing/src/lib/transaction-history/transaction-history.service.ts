import { Code, ConnectError } from '@connectrpc/connect';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import {
  PaymentStatus,
  PaymentType,
  type GetPaymentHistoryRequest,
  type GetPaymentHistoryResponse,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';
import { MetricsService } from '@internal/metrics';
import { TransactionHistoryRepository } from './transaction-history.repository';
import type { TransactionHistoryQuery } from './transaction-history.query';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPPORTED_PAYMENT_STATUSES = [
  PaymentStatus.PENDING,
  PaymentStatus.COMPLETED,
  PaymentStatus.FAILED,
  PaymentStatus.REFUNDED,
] as const;
const SUPPORTED_PAYMENT_TYPES = [
  PaymentType.SUBSCRIPTION,
  PaymentType.ASSESSMENT,
  PaymentType.DOCUMENT_COPY,
] as const;

@Injectable()
export class TransactionHistoryService {
  constructor(
    private readonly transactionHistoryRepository: TransactionHistoryRepository,
    private readonly metrics: MetricsService,
  ) {}

  async getPaymentHistory(request: GetPaymentHistoryRequest): Promise<GetPaymentHistoryResponse> {
    const scope = request.userId?.trim() ? 'user' : 'all';

    try {
      const response = await this.transactionHistoryRepository.getTransactionHistory(
        this.normalizeRequest(request),
      );
      this.metrics.recordPaymentHistoryRequest(scope, 'success');
      return response;
    } catch (error) {
      this.metrics.recordPaymentHistoryRequest(scope, 'failed');
      throw error;
    }
  }

  private normalizeRequest(request: GetPaymentHistoryRequest): TransactionHistoryQuery {
    const pagination = request.pagination;
    const filters = request.filters;
    const dateFrom = filters?.paymentDateRange?.startDate
      ? timestampDate(filters.paymentDateRange.startDate)
      : undefined;
    const dateTo = filters?.paymentDateRange?.endDate
      ? timestampDate(filters.paymentDateRange.endDate)
      : undefined;

    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw invalidArgument('filters.paymentDateRange', 'start_date must be earlier than end_date');
    }

    return {
      userId: normalizeOptionalUuid(request.userId, 'userId'),
      page: normalizePositiveInt(pagination?.page, DEFAULT_PAGE),
      limit: normalizePositiveInt(pagination?.limit, DEFAULT_LIMIT),
      searchQuery: normalizeSearchQuery(filters?.searchQuery),
      statuses: normalizeEnumList(
        filters?.statuses ?? [],
        SUPPORTED_PAYMENT_STATUSES,
        'filters.statuses',
      ),
      types: normalizeEnumList(filters?.types ?? [], SUPPORTED_PAYMENT_TYPES, 'filters.types'),
      dateFrom,
      dateTo,
    };
  }
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (value === undefined || value === 0) {
    return fallback;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw invalidArgument('pagination', 'page and limit must be positive integers');
  }

  return value;
}

function normalizeSearchQuery(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalUuid(value: string | undefined, fieldName: string): string | undefined {
  if (!value) {
    return undefined;
  }

  if (!UUID_PATTERN.test(value)) {
    throw invalidArgument(fieldName, 'must be a valid UUID');
  }

  return value;
}

function normalizeEnumList<T extends number>(
  values: T[],
  supportedValues: readonly T[],
  fieldName: string,
): T[] | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const invalidValue = values.find((value) => !supportedValues.includes(value));
  if (invalidValue !== undefined) {
    throw invalidArgument(fieldName, `contains unsupported value ${invalidValue}`);
  }

  return values;
}

function invalidArgument(fieldName: string, message: string): ConnectError {
  return new ConnectError(`${fieldName} ${message}`, Code.InvalidArgument);
}
