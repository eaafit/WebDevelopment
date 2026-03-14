import { Injectable } from '@nestjs/common';

/**
 * YooKassa (Yandex) payment API client.
 * @see https://yookassa.ru/developers/api
 */

const YOOKASSA_API_BASE = 'https://api.yookassa.ru/v3';

export interface YooKassaCreatePaymentParams {
  amount: string;
  currency: string;
  returnUrl: string;
  description: string;
  idempotenceKey: string;
  metadata?: Record<string, string>;
}

export interface YooKassaCreatePaymentResult {
  id: string;
  confirmationUrl: string;
  status: string;
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
  private readonly shopId: string;
  private readonly secretKey: string;
  private readonly authHeader: string;

  constructor() {
    const shopId = process.env['YOOKASSA_SHOP_ID'] ?? '';
    const secretKey = process.env['YOOKASSA_SECRET_KEY'] ?? '';
    this.shopId = shopId;
    this.secretKey = secretKey;
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
    const body = {
      amount: {
        value: params.amount,
        currency: params.currency,
      },
      confirmation: {
        type: 'redirect',
        return_url: params.returnUrl,
      },
      capture: true,
      description: params.description.slice(0, 128),
      metadata: params.metadata ?? {},
    };

    const res = await fetch(`${YOOKASSA_API_BASE}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
        'Idempotence-Key': params.idempotenceKey,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new YooKassaClientError(
        `YooKassa create payment failed: ${res.status} ${res.statusText}`,
        res.status,
        text,
      );
    }

    const data = JSON.parse(text) as {
      id: string;
      status: string;
      confirmation?: { confirmation_url?: string };
    };

    const confirmationUrl = data.confirmation?.confirmation_url ?? '';
    if (!confirmationUrl) {
      throw new YooKassaClientError('YooKassa response missing confirmation_url', res.status, text);
    }

    return {
      id: data.id,
      confirmationUrl,
      status: data.status,
    };
  }
}
