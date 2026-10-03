import { Injectable } from '@nestjs/common';

export class BitrixOrdersConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BitrixOrdersConfigError';
  }
}

@Injectable()
export class BitrixOrdersConfigService {
  private readonly webhookUrl: string | null = this.tryReadUrl('BITRIX_WEBHOOK_URL');
  private readonly portalUrl: string | null = this.tryReadUrl('BITRIX_PORTAL_URL');

  isConfigured(): boolean {
    return this.webhookUrl !== null && this.portalUrl !== null;
  }

  getWebhookUrl(): string {
    if (this.webhookUrl === null) {
      throw new BitrixOrdersConfigError('BITRIX_WEBHOOK_URL is required');
    }
    return this.webhookUrl;
  }

  getPortalUrl(): string {
    if (this.portalUrl === null) {
      throw new BitrixOrdersConfigError('BITRIX_PORTAL_URL is required');
    }
    return this.portalUrl;
  }

  private tryReadUrl(key: string): string | null {
    const raw = (process.env[key] ?? '').trim();
    if (!raw) return null;
    if (!raw.startsWith('https://')) {
      throw new BitrixOrdersConfigError(`${key} must use https://`);
    }
    try {
      new URL(raw);
      return raw;
    } catch {
      throw new BitrixOrdersConfigError(`${key} is not a valid URL`);
    }
  }
}