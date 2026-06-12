import { Inject, Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import { BitrixOrdersConfigService } from './bitrix-orders-config.service';
import {
  BitrixApiError,
  BitrixAuthError,
  BitrixRateLimitError,
  BitrixUnavailableError,
  BitrixUnknownError,
  BitrixValidationError,
} from './bitrix-orders.errors';
import { BITRIX_ORDERS_HTTP_CLIENT } from './bitrix-orders.tokens';
import {
  BitrixErrorResponse,
  BitrixResponse,
  OrderCreateResult,
  OrderFields,
} from './bitrix-orders.types';

@Injectable()
export class BitrixOrdersApiService {
  constructor(
    private readonly config: BitrixOrdersConfigService,
    @Inject(BITRIX_ORDERS_HTTP_CLIENT) private readonly http: AxiosInstance,
  ) {}

  async createOrder(fields: OrderFields): Promise<OrderCreateResult> {
    const url = this.buildMethodUrl('sale.order.add.json');
    const body = { fields };

    let data: BitrixResponse<OrderCreateResult>;
    try {
      const response = await this.http.post<BitrixResponse<OrderCreateResult>>(url, body);
      data = response.data;
    } catch (error) {
      throw this.mapAxiosError(error);
    }

    if ('error' in data) {
      throw this.mapBitrixError(data.error, data.error_description);
    }

    if (typeof data.result !== 'number') {
      throw new BitrixUnknownError(
        `Unexpected response format: result is not a number (type: ${typeof data.result})`,
        data,
      );
    }

    return data.result;
  }

  private buildMethodUrl(method: string): string {
    const webhook = this.config.getWebhookUrl();
    const base = webhook.endsWith('/') ? webhook : `${webhook}/`;
    return `${base}${method}`;
  }

  private mapBitrixError(code: string, description: string | undefined): BitrixApiError {
    const msg = description?.trim() || code;
    switch (code) {
      case 'NO_AUTH_FOUND':
      case 'ACCESS_DENIED':
      case 'INVALID_CREDENTIALS':
      case 'expired_token':
        return new BitrixAuthError(`Bitrix auth error: ${msg}`);
      case 'QUERY_LIMIT_EXCEEDED':
        return new BitrixRateLimitError(`Bitrix rate limit: ${msg}`);
      case 'INTERNAL_SERVER_ERROR':
      case 'ERROR_CORE':
        return new BitrixUnavailableError(`Bitrix unavailable: ${msg}`);
      default:
        return new BitrixValidationError(`Bitrix validation error (${code}): ${msg}`);
    }
  }

  private mapAxiosError(error: unknown): BitrixApiError {
    if (!axios.isAxiosError(error)) {
      const detail = error instanceof Error ? error.message : String(error);
      return new BitrixUnknownError(`Unknown error: ${detail}`, error);
    }

    const response = error.response;
    if (!response) {
      return new BitrixUnavailableError(`Bitrix unavailable: ${error.message}`, error);
    }

    if (response.status >= 500 && response.status < 600) {
      return new BitrixUnavailableError(`Bitrix returned ${response.status}: ${error.message}`, error);
    }

    const body = response.data as Partial<BitrixErrorResponse> | undefined;
    if (body && typeof body === 'object' && typeof body.error === 'string') {
      return this.mapBitrixError(body.error, body.error_description);
    }

    return new BitrixUnknownError(`HTTP ${response.status} without parsable error`, error);
  }
}