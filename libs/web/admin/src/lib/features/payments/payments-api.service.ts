import { timestampDate } from '@bufbuild/protobuf/wkt';
import { ConnectError, createClient } from '@connectrpc/connect';
import {
  PaymentService,
  PaymentStatus as RpcPaymentStatus,
  PaymentType as RpcPaymentType,
  type Payment as RpcPayment,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT, WebLoggerService } from '@notary-portal/ui';
import { BehaviorSubject } from 'rxjs';
import {
  PAYMENT_STATUS_LABELS,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
  type PaymentType,
} from './payments.shared';

const PAGE_LIMIT = 100;

@Injectable({ providedIn: 'root' })
export class AdminPaymentsApiService {
  private readonly client = createClient(PaymentService, inject(RPC_TRANSPORT));
  private readonly logger = inject(WebLoggerService);
  private cache: Promise<Payment[]> | null = null;
  private readonly paymentsSubject = new BehaviorSubject<Payment[] | null>(null);
  readonly payments$ = this.paymentsSubject.asObservable();

  preload(): void {
    if (!this.cache) {
      this.logInfo('payment.admin.api.preload_started');
      this.cache = this.fetchAllPayments();
      this.cache.then((data) => this.paymentsSubject.next(data));
    }
  }

  async getAllPayments(): Promise<Payment[]> {
    if (!this.cache) {
      this.logInfo('payment.admin.api.get_all_started');
      this.cache = this.fetchAllPayments();
      this.cache.then((data) => this.paymentsSubject.next(data));
    }
    return this.cache;
  }

  invalidateCache(): void {
    this.logInfo('payment.admin.api.cache_invalidated');
    this.cache = null;
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    this.logInfo('payment.admin.api.get_by_id_started', { paymentId: id });
    const response = await this.client.getPaymentHistory({
      pagination: { page: 1, limit: 200 },
      filters: { searchQuery: id },
    });
    const match = response.payments.find((p) => p.id === id);
    if (!match) {
      this.logWarn('payment.admin.api.get_by_id_not_found', { paymentId: id });
    }
    return match ? this.toAdminPayment(match) : null;
  }

  async createPayment(params: {
    userId: string;
    amount: string;
    type: RpcPaymentType;
    targetId: string;
  }): Promise<{ paymentId: string }> {
    this.logInfo('payment.admin.api.create_started', {
      targetId: params.targetId,
      paymentType: RpcPaymentType[params.type],
    });
    const response = await this.client.createPayment({
      userId: params.userId,
      amount: params.amount,
      type: params.type,
      targetId: params.targetId,
    });
    this.invalidateCache();
    await this.getAllPayments();
    this.logInfo('payment.admin.api.create_succeeded', { paymentId: response.paymentId });
    return { paymentId: response.paymentId };
  }

  async updatePayment(params: {
    id: string;
    amount?: string;
    status?: RpcPaymentStatus;
    paymentMethod?: string;
    transactionId?: string;
    attachmentFileName?: string;
    attachmentFileUrl?: string;
  }): Promise<Payment> {
    try {
      this.logInfo('payment.admin.api.update_started', { paymentId: params.id });
      const response = await this.client.updatePayment({
        id: params.id,
        amount: params.amount,
        status: params.status,
        paymentMethod: params.paymentMethod,
        transactionId: params.transactionId,
        attachmentFileName: params.attachmentFileName,
        attachmentFileUrl: params.attachmentFileUrl,
      });

      if (!response.payment) {
        this.logWarn('payment.admin.api.update_missing_payload', { paymentId: params.id });
        throw new Error('Сервер не вернул обновлённый платёж');
      }

      await this.refreshCache();
      this.logInfo('payment.admin.api.update_succeeded', { paymentId: params.id });
      return this.toAdminPayment(response.payment);
    } catch (error) {
      this.logError('payment.admin.api.update_failed', error, { paymentId: params.id });
      throw mapPaymentsError(error, 'Не удалось обновить платёж');
    }
  }

  async deletePayment(id: string): Promise<boolean> {
    try {
      this.logInfo('payment.admin.api.delete_started', { paymentId: id });
      const response = await this.client.deletePayment({ id });

      if (!response.success) {
        this.logWarn('payment.admin.api.delete_rejected', { paymentId: id });
        throw new Error('Сервер не подтвердил удаление платежа');
      }

      await this.refreshCache();
      this.logInfo('payment.admin.api.delete_succeeded', { paymentId: id });
      return true;
    } catch (error) {
      this.logError('payment.admin.api.delete_failed', error, { paymentId: id });
      throw mapPaymentsError(error, 'Не удалось удалить платёж');
    }
  }

  private async refreshCache(): Promise<void> {
    this.logInfo('payment.admin.api.refresh_started');
    this.cache = this.fetchAllPayments();
    const data = await this.cache;
    this.paymentsSubject.next(data);
    this.logInfo('payment.admin.api.refresh_succeeded', { total: data.length });
  }

  private async fetchAllPayments(): Promise<Payment[]> {
    this.logInfo('payment.admin.api.fetch_all_started');
    const result: Payment[] = [];
    let page = 1;

    while (true) {
      const response = await this.client.getPaymentHistory({
        pagination: { page, limit: PAGE_LIMIT },
        filters: {},
      });
      this.logInfo('payment.admin.api.fetch_page_succeeded', {
        page,
        pageSize: response.payments.length,
      });

      result.push(...response.payments.map((payment) => this.toAdminPayment(payment)));

      const totalPages = response.meta?.totalPages ?? 1;
      if (page >= totalPages || response.payments.length === 0) {
        break;
      }

      page += 1;
    }

    this.logInfo('payment.admin.api.fetch_all_succeeded', { total: result.length });
    return result;
  }

  private logInfo(event: string, context: Record<string, unknown> = {}): void {
    this.logger.info(event, this.buildLogContext(context));
  }

  private logWarn(event: string, context: Record<string, unknown> = {}): void {
    this.logger.warn(event, this.buildLogContext(context));
  }

  private logError(event: string, error: unknown, context: Record<string, unknown> = {}): void {
    this.logger.error(event, this.buildLogContext({ ...context, error }));
  }

  private buildLogContext(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      area: 'admin_payments_api',
      cached: this.cache !== null,
      ...extra,
    };
  }

  private toAdminPayment(payment: RpcPayment): Payment {
    const status = fromRpcPaymentStatus(payment.status);
    const userId = payment.userId || '—';

    return {
      id: payment.id,
      userId: payment.userId || undefined,
      paymentDate: payment.paymentDate
        ? timestampDate(payment.paymentDate).toISOString().slice(0, 10)
        : '',
      payer: userId,
      amount: Number(payment.amount?.amount ?? '0'),
      currency: payment.amount?.currency ?? 'RUB',
      fee: 0,
      status,
      statusText: PAYMENT_STATUS_LABELS[status],
      type: fromRpcPaymentType(payment.type),
      subscriptionId: nullIfEmpty(payment.subscriptionId),
      assessmentId: nullIfEmpty(payment.assessmentId),
      paymentMethod: toPaymentMethod(payment.paymentMethod),
      transactionId: nullIfEmpty(payment.transactionId) ?? undefined,
      attachmentFileName: nullIfEmpty(payment.attachmentFileName) ?? undefined,
      attachmentFileUrl: nullIfEmpty(payment.attachmentFileUrl) ?? undefined,
    };
  }
}

function fromRpcPaymentStatus(status: RpcPaymentStatus): PaymentStatus {
  switch (status) {
    case RpcPaymentStatus.COMPLETED:
      return 'completed';
    case RpcPaymentStatus.FAILED:
      return 'failed';
    case RpcPaymentStatus.REFUNDED:
      return 'refunded';
    case RpcPaymentStatus.PENDING:
    case RpcPaymentStatus.UNSPECIFIED:
    default:
      return 'pending';
  }
}

function fromRpcPaymentType(type: RpcPaymentType): PaymentType {
  switch (type) {
    case RpcPaymentType.SUBSCRIPTION:
      return 'Subscription';
    case RpcPaymentType.DOCUMENT_COPY:
      return 'DocumentCopy';
    case RpcPaymentType.ASSESSMENT:
    case RpcPaymentType.UNSPECIFIED:
    default:
      return 'Assessment';
  }
}

function toPaymentMethod(method: string): PaymentMethod | undefined {
  switch (method) {
    case 'card':
    case 'cash':
    case 'invoice':
      return method;
    default:
      return undefined;
  }
}

function nullIfEmpty(value: string): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function mapPaymentsError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof ConnectError) {
    return new Error(error.rawMessage || error.message || fallbackMessage);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}
