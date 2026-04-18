import { createClient } from '@connectrpc/connect';
import { Injectable, inject } from '@angular/core';
import { PaymentService, PaymentStatus, type PaymentType } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '@notary-portal/ui';

export type CheckoutPaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded' | 'not_found';

@Injectable({ providedIn: 'root' })
export class CheckoutApiService {
  private readonly client = createClient(PaymentService, inject(RPC_TRANSPORT));

  createPayment(params: { userId: string; amount: string; type: PaymentType; targetId: string }) {
    return this.client.createPayment({
      userId: params.userId,
      amount: params.amount,
      type: params.type,
      targetId: params.targetId,
      promoCode: '',
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
