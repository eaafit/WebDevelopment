import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  PaymentService,
  PaymentStatus as RpcPaymentStatus,
  PaymentType as RpcPaymentType,
  type Payment as RpcPayment,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT } from '@notary-portal/ui';
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
  private cache: Promise<Payment[]> | null = null;
  private readonly paymentsSubject = new BehaviorSubject<Payment[] | null>(null);
  readonly payments$ = this.paymentsSubject.asObservable();

  preload(): void {
    if (!this.cache) {
      this.cache = this.fetchAllPayments();
      this.cache.then((data) => this.paymentsSubject.next(data));
    }
  }

  async getAllPayments(): Promise<Payment[]> {
    if (!this.cache) {
      this.cache = this.fetchAllPayments();
      this.cache.then((data) => this.paymentsSubject.next(data));
    }
    return this.cache;
  }

  invalidateCache(): void {
    this.cache = null;
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    const response = await this.client.getPaymentHistory({
      pagination: { page: 1, limit: 200 },
      filters: { searchQuery: id },
    });
    const match = response.payments.find((p) => p.id === id);
    return match ? this.toAdminPayment(match) : null;
  }

  async createPayment(params: {
    userId: string;
    amount: string;
    type: RpcPaymentType;
    targetId: string;
  }): Promise<{ paymentId: string }> {
    const response = await this.client.createPayment({
      userId: params.userId,
      amount: params.amount,
      type: params.type,
      targetId: params.targetId,
      promoCode: '',
    });
    this.invalidateCache();
    await this.getAllPayments();
    return { paymentId: response.paymentId };
  }

  private async fetchAllPayments(): Promise<Payment[]> {
    const result: Payment[] = [];
    let page = 1;

    while (true) {
      const response = await this.client.getPaymentHistory({
        pagination: { page, limit: PAGE_LIMIT },
        filters: {},
      });

      result.push(...response.payments.map((payment) => this.toAdminPayment(payment)));

      const totalPages = response.meta?.totalPages ?? 1;
      if (page >= totalPages || response.payments.length === 0) {
        break;
      }

      page += 1;
    }

    return result;
  }

  private toAdminPayment(payment: RpcPayment): Payment {
    const status = fromRpcPaymentStatus(payment.status);

    return {
      id: payment.id,
      paymentDate: payment.paymentDate
        ? timestampDate(payment.paymentDate).toISOString().slice(0, 10)
        : '',
      payer: payment.userId || '—',
      amount: Number(payment.amount?.amount ?? '0'),
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
