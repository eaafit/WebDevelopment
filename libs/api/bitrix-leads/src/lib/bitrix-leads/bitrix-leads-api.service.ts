import { Inject, Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import { BitrixLeadsConfigService } from './bitrix-leads-config.service';
import {
  BitrixApiError,
  BitrixAuthError,
  BitrixRateLimitError,
  BitrixUnavailableError,
  BitrixUnknownError,
  BitrixValidationError,
} from './bitrix-leads.errors';
import { BITRIX_LEADS_HTTP_CLIENT } from './bitrix-leads.tokens';
import {
  BitrixErrorResponse,
  BitrixResponse,
  LeadCreateResult,
  LeadFields,
} from './bitrix-leads.types';

@Injectable()
export class BitrixLeadsApiService {
  constructor(
    private readonly config: BitrixLeadsConfigService,
    @Inject(BITRIX_LEADS_HTTP_CLIENT) private readonly http: AxiosInstance,
  ) {}

  async createLead(fields: LeadFields): Promise<LeadCreateResult> {
    const url = this.buildMethodUrl('crm.lead.add.json');
    const body = {
      fields,
      params: { REGISTER_SONET_EVENT: 'Y' },
    };

    let data: BitrixResponse<LeadCreateResult>;
    try {
      const response = await this.http.post<BitrixResponse<LeadCreateResult>>(url, body);
      data = response.data;
    } catch (error) {
      throw this.mapAxiosError(error);
    }

    if ('error' in data) {
      throw this.mapBitrixError(data.error, data.error_description);
    }

    if (typeof data.result !== 'number') {
      throw new BitrixUnknownError(
        `Неожиданный формат ответа от Bitrix: result не число (тип: ${typeof data.result}).`,
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
        return new BitrixAuthError(`Bitrix отверг авторизацию: ${msg}`);
      case 'QUERY_LIMIT_EXCEEDED':
        return new BitrixRateLimitError(`Bitrix rate limit: ${msg}`);
      case 'INTERNAL_SERVER_ERROR':
      case 'ERROR_CORE':
        return new BitrixUnavailableError(`Bitrix недоступен: ${msg}`);
      default:
        return new BitrixValidationError(`Bitrix отверг данные (${code}): ${msg}`);
    }
  }

  private mapAxiosError(error: unknown): BitrixApiError {
    if (!axios.isAxiosError(error)) {
      const detail = error instanceof Error ? error.message : String(error);
      return new BitrixUnknownError(`Неизвестная ошибка вызова Bitrix: ${detail}`, error);
    }

    const response = error.response;
    if (!response) {
      return new BitrixUnavailableError(`Bitrix недоступен: ${error.message}`, error);
    }

    if (response.status >= 500 && response.status < 600) {
      return new BitrixUnavailableError(
        `Bitrix вернул ${response.status}: ${error.message}`,
        error,
      );
    }

    const body = response.data as Partial<BitrixErrorResponse> | undefined;
    if (body && typeof body === 'object' && typeof body.error === 'string') {
      return this.mapBitrixError(body.error, body.error_description);
    }

    return new BitrixUnknownError(
      `HTTP ${response.status} от Bitrix без распарсиваемой ошибки: ${error.message}`,
      error,
    );
  }
}
