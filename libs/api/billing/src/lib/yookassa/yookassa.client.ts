import { Injectable } from '@nestjs/common';

/**
 * YooKassa payment API client.
 * @see https://yookassa.ru/developers/api
 */

const YOOKASSA_API_BASE = 'https://api.yookassa.ru/v3';

export interface YooKassaReceiptCustomer {
  email: string;
}

export interface YooKassaReceiptItem {
  description: string;
  quantity: string;
  amount: {
    value: string;
    currency: string;
  };
  vatCode: number;
  paymentMode: 'full_prepayment' | 'full_payment';
  paymentSubject: 'service';
}

export interface YooKassaReceipt {
  customer: YooKassaReceiptCustomer;
  items: YooKassaReceiptItem[];
  internet: boolean;
}

export type YooKassaReceiptRegistration = 'pending' | 'succeeded' | 'canceled';

export interface YooKassaCreatePaymentParams {
  amount: string;
  currency: string;
  returnUrl?: string;
  description: string;
  idempotenceKey: string;
  confirmationType: 'redirect' | 'embedded';
  metadata?: Record<string, string>;
  receipt?: YooKassaReceipt;
}

export interface YooKassaCreatePaymentResult {
  id: string;
  confirmationUrl: string | null;
  confirmationToken: string;
  status: string;
  receiptRegistration: YooKassaReceiptRegistration | null;
}

export interface YooKassaPaymentDetails {
  id: string;
  status: string;
  paid: boolean;
  amountValue: string;
  amountCurrency: string;
  paymentMethodType: string | null;
  paymentMethodTitle: string | null;
  receiptRegistration: YooKassaReceiptRegistration | null;
  createdAt: string | null;
  capturedAt: string | null;
  metadata: Record<string, string>;
}

export class YooKassaClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = 'YooKassaClientError';
  }
}

@Injectable()
export class YooKassaClient {
  private readonly authHeader: string;

  constructor() {
    const shopId = process.env['YOOKASSA_SHOP_ID'] ?? '';
    const secretKey = process.env['YOOKASSA_SECRET_KEY'] ?? '';
    this.authHeader =
      shopId && secretKey
        ? 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64')
        : '';
  }

  async createPayment(params: YooKassaCreatePaymentParams): Promise<YooKassaCreatePaymentResult> {
    if (!this.authHeader) {
      throw new YooKassaClientError(
        'YooKassa is not configured: set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY',
      );
    }

    const confirmation =
      params.confirmationType === 'redirect'
        ? {
            type: 'redirect' as const,
            return_url: params.returnUrl,
          }
        : {
            type: 'embedded' as const,
          };

    const body = {
      amount: {
        value: params.amount,
        currency: params.currency,
      },
      confirmation,
      capture: true,
      description: params.description.slice(0, 128),
      metadata: params.metadata ?? {},
      ...(params.receipt ? { receipt: mapReceipt(params.receipt) } : {}),
    };

    const text = await this.request('POST', '/payments', params.idempotenceKey, body);
    const data = JSON.parse(text) as {
      id: string;
      status: string;
      receipt_registration?: string;
      confirmation?: {
        confirmation_url?: string;
        confirmation_token?: string;
      };
    };

    const confirmationToken = data.confirmation?.confirmation_token ?? '';
    const confirmationUrl = data.confirmation?.confirmation_url ?? null;

    if (params.confirmationType === 'embedded' && !confirmationToken) {
      throw new YooKassaClientError('YooKassa response missing confirmation_token');
    }

    if (params.confirmationType === 'redirect' && !confirmationUrl) {
      throw new YooKassaClientError('YooKassa response missing confirmation_url');
    }

    return {
      id: data.id,
      confirmationUrl,
      confirmationToken,
      status: data.status,
      receiptRegistration: parseReceiptRegistration(data.receipt_registration),
    };
  }

  async getPayment(paymentId: string): Promise<YooKassaPaymentDetails> {
    if (!this.authHeader) {
      throw new YooKassaClientError(
        'YooKassa is not configured: set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY',
      );
    }

    const text = await this.request('GET', `/payments/${paymentId}`);
    const data = JSON.parse(text) as {
      id: string;
      status: string;
      paid?: boolean;
      amount?: {
        value?: string;
        currency?: string;
      };
      created_at?: string;
      captured_at?: string;
      receipt_registration?: string;
      payment_method?: {
        type?: string;
        title?: string;
      };
      metadata?: Record<string, string>;
    };

    return {
      id: data.id,
      status: data.status,
      paid: Boolean(data.paid),
      amountValue: data.amount?.value ?? '0.00',
      amountCurrency: data.amount?.currency ?? 'RUB',
      paymentMethodType: data.payment_method?.type ?? null,
      paymentMethodTitle: data.payment_method?.title ?? null,
      receiptRegistration: parseReceiptRegistration(data.receipt_registration),
      createdAt: data.created_at ?? null,
      capturedAt: data.captured_at ?? null,
      metadata: data.metadata ?? {},
    };
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    idempotenceKey?: string,
    body?: unknown,
  ): Promise<string> {
    const res = await fetch(`${YOOKASSA_API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
        ...(idempotenceKey ? { 'Idempotence-Key': idempotenceKey } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new YooKassaClientError(
        `YooKassa request failed: ${res.status} ${res.statusText}`,
        res.status,
        text,
      );
    }

    return text;
  }
}

function mapReceipt(receipt: YooKassaReceipt) {
  return {
    customer: {
      email: receipt.customer.email,
    },
    items: receipt.items.map((item) => ({
      description: item.description.slice(0, 128),
      quantity: item.quantity,
      amount: item.amount,
      vat_code: item.vatCode,
      payment_mode: item.paymentMode,
      payment_subject: item.paymentSubject,
    })),
    internet: receipt.internet,
  };
}

function parseReceiptRegistration(value: string | undefined): YooKassaReceiptRegistration | null {
  switch (value) {
    case 'pending':
    case 'succeeded':
    case 'canceled':
      return value;
    default:
      return null;
  }
}
