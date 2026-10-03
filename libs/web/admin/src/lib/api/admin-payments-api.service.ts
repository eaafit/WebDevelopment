import { ConnectError, createClient } from '@connectrpc/connect';
import {
  PaymentService,
  PaymentStatus as RpcPaymentStatus,
  PaymentType as RpcPaymentType,
  type Payment as RpcPayment,
} from '@notary-portal/api-contracts';
import {
  RPC_TRANSPORT,
  buildPaymentHistoryRequest,
  fromRpcPaymentStatus,
  normalizeOptionalString,
  toPaymentHistoryPage,
  toPaymentHistoryRecord,
  type PaymentHistoryRecord,
  type TransactionPageMeta,
} from '@notary-portal/ui';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, catchError, from, map, throwError, type Observable } from 'rxjs';
import {
  PAYMENT_STATUS_LABELS,
  type Payment,
  type PaymentType,
} from '../features/payments/payments.shared';

const EXPORT_PAGE_LIMIT = 500;
const LOOKUP_PAGE_LIMIT = 50;

export interface PaymentQuery {
  page: number;
  limit: number;
  searchQuery?: string;
  statuses?: RpcPaymentStatus[];
  type?: RpcPaymentType;
  types?: RpcPaymentType[];
  dateFrom?: string;
  dateTo?: string;
}

export interface PaymentHistoryPage {
  payments: Payment[];
  meta: TransactionPageMeta | null;
}

export type AdminPayment = Payment;

@Injectable({ providedIn: 'root' })
export class AdminPaymentsApiService {
  private readonly client = createClient(PaymentService, inject(RPC_TRANSPORT));
  private readonly paymentsSubject = new BehaviorSubject<Payment[] | null>(null);
  readonly payments$ = this.paymentsSubject.asObservable();

  preload(): void {
    // Kept for callers that warm other admin sections. The list page loads with explicit filters.
  }

  listPayments(query: PaymentQuery): Observable<PaymentHistoryPage> {
    return from(this.client.getPaymentHistory(this.toHistoryRequest(query))).pipe(
      map((response) => {
        const page = toPaymentHistoryPage(response);
        const payments = page.payments.map((payment) => this.toAdminPayment(payment));
        this.paymentsSubject.next(payments);

        return {
          payments,
          meta: page.meta,
        };
      }),
      catchError((error) => throwError(() => mapPaymentsError(error, 'Не удалось загрузить платежи'))),
    );
  }

  async getAllPayments(filters: Partial<Omit<PaymentQuery, 'page' | 'limit'>> = {}): Promise<Payment[]> {
    try {
      const result: Payment[] = [];
      let page = 1;

      while (true) {
        const response = await this.client.getPaymentHistory(
          this.toHistoryRequest({
            ...filters,
            page,
            limit: EXPORT_PAGE_LIMIT,
          }),
        );
        const mappedPage = toPaymentHistoryPage(response);
        result.push(...mappedPage.payments.map((payment) => this.toAdminPayment(payment)));

        const totalPages = mappedPage.meta?.totalPages ?? 1;
        if (page >= totalPages || mappedPage.payments.length === 0) {
          break;
        }

        page += 1;
      }

      return result;
    } catch (error) {
      throw mapPaymentsError(error, 'Не удалось загрузить платежи для экспорта');
    }
  }

  invalidateCache(): void {
    this.paymentsSubject.next(null);
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    try {
      const response = await this.client.getPaymentHistory(
        this.toHistoryRequest({
          page: 1,
          limit: LOOKUP_PAGE_LIMIT,
          searchQuery: id,
        }),
      );
      const match = response.payments.find((payment) => payment.id === id);

      return match ? this.toAdminPaymentFromRpc(match) : null;
    } catch (error) {
      throw mapPaymentsError(error, 'Не удалось загрузить платёж');
    }
  }

  async createPayment(params: {
    userId: string;
    amount: string;
    type: RpcPaymentType;
    targetId: string;
  }): Promise<{ paymentId: string }> {
    try {
      const response = await this.client.createPayment({
        userId: params.userId,
        amount: params.amount,
        type: params.type,
        targetId: params.targetId,
      });
      this.invalidateCache();

      return { paymentId: response.paymentId };
    } catch (error) {
      throw mapPaymentsError(error, 'Не удалось создать платёж');
    }
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
        throw new Error('Сервер не вернул обновлённый платёж');
      }

      this.invalidateCache();
      return this.toAdminPaymentFromRpc(response.payment);
    } catch (error) {
      throw mapPaymentsError(error, 'Не удалось обновить платёж');
    }
  }

  async deletePayment(id: string): Promise<boolean> {
    try {
      const response = await this.client.deletePayment({ id });

      if (!response.success) {
        throw new Error('Сервер не подтвердил удаление платежа');
      }

      this.invalidateCache();
      return true;
    } catch (error) {
      throw mapPaymentsError(error, 'Не удалось удалить платёж');
    }
  }

  private toHistoryRequest(
    query: PaymentQuery | (Partial<Omit<PaymentQuery, 'page' | 'limit'>> & { page: number; limit: number }),
  ) {
    return buildPaymentHistoryRequest({
      page: query.page,
      limit: query.limit,
      searchQuery: query.searchQuery,
      statuses: query.statuses ?? [],
      types: query.types ?? (query.type ? [query.type] : []),
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  private toAdminPaymentFromRpc(payment: RpcPayment): Payment {
    return this.toAdminPayment(toPaymentHistoryRecord(payment));
  }

  private toAdminPayment(payment: PaymentHistoryRecord): Payment {
    const status = fromRpcPaymentStatus(payment.status);
    const userId = normalizeOptionalString(payment.userId) ?? '—';

    return {
      id: payment.id,
      userId,
      paymentDate: payment.paymentDate,
      payer: userId,
      amount: Number(payment.amount || '0'),
      currency: payment.currency || 'RUB',
      fee: 0,
      status,
      statusText: PAYMENT_STATUS_LABELS[status],
      type: fromRpcAdminPaymentType(payment.type),
      subscriptionId: payment.subscriptionId,
      assessmentId: payment.assessmentId,
      paymentMethod: payment.paymentMethod ?? undefined,
      transactionId: payment.transactionId ?? undefined,
      attachmentFileName: payment.attachmentFileName ?? undefined,
      attachmentFileUrl: payment.attachmentFileUrl ?? undefined,
      description: payment.description,
    };
  }
}

function fromRpcAdminPaymentType(type: RpcPaymentType): PaymentType {
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

function mapPaymentsError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof ConnectError) {
    return new Error(error.rawMessage || error.message || fallbackMessage);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}
