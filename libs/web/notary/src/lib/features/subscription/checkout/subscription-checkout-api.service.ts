import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { PaymentService, PaymentStatus, PaymentType } from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { resolveSubscriptionPlan, type SubscriptionPlanCode } from './subscription-checkout.models';

export type CheckoutPaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded' | 'not_found';

@Injectable({ providedIn: 'root' })
export class SubscriptionCheckoutApiService {
  private readonly client = createClient(PaymentService, inject(RPC_TRANSPORT));

  async createSubscriptionDraft(params: {
    userId: string;
    planCode: SubscriptionPlanCode;
  }): Promise<string> {
    const plan = resolveSubscriptionPlan(params.planCode);
    const startDate = normalizeDate(new Date());
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const response = await this.client.createSubscription({
      userId: params.userId,
      plan: plan.rpcPlan,
      startDate: timestampFromDate(startDate),
      endDate: timestampFromDate(endDate),
    });

    const subscriptionId = response.subscription?.id?.trim();
    if (!subscriptionId) {
      throw new Error('Backend did not return a subscription draft');
    }

    return subscriptionId;
  }

  createPayment(params: {
    userId: string;
    amount: string;
    subscriptionId: string;
    promoCode?: string;
  }) {
    return this.client.createPayment({
      userId: params.userId,
      amount: params.amount,
      type: PaymentType.SUBSCRIPTION,
      targetId: params.subscriptionId,
      promoCode: params.promoCode?.trim() ?? '',
    });
  }

  async waitForPaymentStatus(params: {
    userId: string;
    paymentId: string;
    attempts?: number;
    intervalMs?: number;
  }): Promise<CheckoutPaymentStatus> {
    const attempts = params.attempts ?? 12;
    const intervalMs = params.intervalMs ?? 1500;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const status = await this.getPaymentStatus(params.userId, params.paymentId);
      if (status !== 'pending' && status !== 'not_found') {
        return status;
      }

      if (attempt < attempts - 1) {
        await delay(intervalMs);
      }
    }

    return 'pending';
  }

  private async getPaymentStatus(
    userId: string,
    paymentId: string,
  ): Promise<CheckoutPaymentStatus> {
    const response = await this.client.getPaymentHistory({
      userId,
      pagination: {
        page: 1,
        limit: 1,
      },
      filters: {
        searchQuery: paymentId,
      },
    });

    const payment = response.payments[0];
    if (!payment) {
      return 'not_found';
    }

    switch (payment.status) {
      case PaymentStatus.COMPLETED:
        return 'completed';
      case PaymentStatus.FAILED:
        return 'failed';
      case PaymentStatus.REFUNDED:
        return 'refunded';
      case PaymentStatus.PENDING:
      default:
        return 'pending';
    }
  }
}

function normalizeDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
