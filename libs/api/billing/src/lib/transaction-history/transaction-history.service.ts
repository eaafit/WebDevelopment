import { Code, ConnectError } from '@connectrpc/connect';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import {
  PaymentStatus,
  PaymentType,
  type Payment,
  type DeletePaymentRequest,
  type DeletePaymentResponse,
  type GetPaymentHistoryRequest,
  type GetPaymentHistoryResponse,
  type UpdatePaymentRequest,
  type UpdatePaymentResponse,
} from '@notary-portal/api-contracts';
import { getCurrentUser } from '@internal/auth-shared';
import { AuditService } from '@internal/audit';
import { Injectable } from '@nestjs/common';
import { MetricsService } from '@internal/metrics';
import { NotificationService } from '@internal/notification';
import {
  TransactionHistoryRepository,
  type PaymentAuditSnapshot,
} from './transaction-history.repository';
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
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
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

  async updatePayment(request: UpdatePaymentRequest): Promise<UpdatePaymentResponse> {
    if (!UUID_PATTERN.test(request.id)) {
      throw invalidArgument('id', 'must be a valid UUID');
    }

    if (request.status === PaymentStatus.UNSPECIFIED) {
      throw invalidArgument('status', 'must not be UNSPECIFIED');
    }

    if (request.amount !== undefined && !/^\d+(\.\d{1,2})?$/.test(request.amount)) {
      throw invalidArgument('amount', 'must be a valid decimal (up to 2 fractional digits)');
    }

    const before = await this.transactionHistoryRepository.getPaymentAuditSnapshot(request.id);
    const response = await this.transactionHistoryRepository.updatePayment(request);

    if (!response.payment) {
      return response;
    }

    const actorUserId = getCurrentUser()?.sub;
    const after = toAuditSnapshotFromPayment(response.payment);
    const target = resolveAuditTarget(after.id, after.assessmentId);
    const shortPaymentId = shortId(after.id);

    try {
      await this.auditService.record({
        actorUserId,
        eventType: 'payment.updated',
        targetType: target.targetType,
        targetId: target.targetId,
        actionTitle: 'Платёж обновлён',
        actionContext: `Обновлён платёж ${shortPaymentId}`,
        targetTitle: target.targetTitle,
        targetContext: target.targetContext,
        ...(before ? { before: toAuditJsonFromSnapshot(before) } : {}),
        after: toAuditJsonFromSnapshot(after),
      });
    } catch {
      // audit failure must not break the main operation
    }

    try {
      await this.notificationService.createInternalNotification({
        userId: after.userId,
        message: `Платёж ${shortPaymentId} обновлён`,
      });
    } catch {
      // notification failure must not break the main operation
    }

    return response;
  }

  async deletePayment(request: DeletePaymentRequest): Promise<DeletePaymentResponse> {
    if (!UUID_PATTERN.test(request.id)) {
      throw invalidArgument('id', 'must be a valid UUID');
    }

    const before = await this.transactionHistoryRepository.getPaymentAuditSnapshot(request.id);
    const response = await this.transactionHistoryRepository.deletePayment(request);

    if (!before) {
      return response;
    }

    const actorUserId = getCurrentUser()?.sub;
    const target = resolveAuditTarget(before.id, before.assessmentId);
    const shortPaymentId = shortId(before.id);

    try {
      await this.auditService.record({
        actorUserId,
        eventType: 'payment.deleted',
        targetType: target.targetType,
        targetId: target.targetId,
        actionTitle: 'Платёж удалён',
        actionContext: `Удалён платёж ${shortPaymentId}`,
        targetTitle: target.targetTitle,
        targetContext: target.targetContext,
        before: toAuditJsonFromSnapshot(before),
      });
    } catch {
      // audit failure must not break the main operation
    }

    try {
      await this.notificationService.createInternalNotification({
        userId: before.userId,
        message: `Платёж ${shortPaymentId} удалён`,
      });
    } catch {
      // notification failure must not break the main operation
    }

    return response;
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

function toAuditSnapshotFromPayment(payment: Payment): PaymentAuditSnapshot {
  return {
    id: payment.id,
    userId: payment.userId,
    status: toStatusText(payment.status),
    amount: payment.amount?.amount ?? '0',
    type: toTypeText(payment.type),
    paymentMethod: payment.paymentMethod || null,
    transactionId: payment.transactionId || null,
    assessmentId: payment.assessmentId || null,
    subscriptionId: payment.subscriptionId || null,
  };
}

function resolveAuditTarget(paymentId: string, assessmentId: string | null) {
  if (assessmentId) {
    return {
      targetType: 'Assessment',
      targetId: assessmentId,
      targetTitle: `Заявка ${shortId(assessmentId)}`,
      targetContext: `Платёж ${shortId(paymentId)}`,
    };
  }

  return {
    targetType: 'Payment',
    targetId: paymentId,
    targetTitle: `Платёж ${shortId(paymentId)}`,
    targetContext: 'Без заявки',
  };
}

function toAuditJsonFromSnapshot(snapshot: PaymentAuditSnapshot) {
  return {
    paymentId: snapshot.id,
    userId: snapshot.userId,
    status: snapshot.status,
    amount: snapshot.amount,
    type: snapshot.type,
    paymentMethod: snapshot.paymentMethod,
    transactionId: snapshot.transactionId,
    assessmentId: snapshot.assessmentId,
    subscriptionId: snapshot.subscriptionId,
  };
}

function toStatusText(status: PaymentStatus): string {
  switch (status) {
    case PaymentStatus.COMPLETED:
      return 'Completed';
    case PaymentStatus.FAILED:
      return 'Failed';
    case PaymentStatus.REFUNDED:
      return 'Refunded';
    case PaymentStatus.PENDING:
    case PaymentStatus.UNSPECIFIED:
    default:
      return 'Pending';
  }
}

function toTypeText(type: PaymentType): string {
  switch (type) {
    case PaymentType.SUBSCRIPTION:
      return 'Subscription';
    case PaymentType.DOCUMENT_COPY:
      return 'DocumentCopy';
    case PaymentType.ASSESSMENT:
    case PaymentType.UNSPECIFIED:
    default:
      return 'Assessment';
  }
}

function shortId(value: string): string {
  return value.length > 8 ? `#${value.slice(0, 8)}` : `#${value}`;
}
