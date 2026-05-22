import { Injectable } from '@nestjs/common';

export class BitrixLeadsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BitrixLeadsConfigError';
  }
}

@Injectable()
export class BitrixLeadsConfigService {
  private readonly webhookUrl = this.readUrl('BITRIX_WEBHOOK_URL');
  private readonly portalUrl = this.readUrl('BITRIX_PORTAL_URL');

  getWebhookUrl(): string {
    return this.webhookUrl;
  }

  getPortalUrl(): string {
    return this.portalUrl;
  }

  private readUrl(key: string): string {
    const raw = (process.env[key] ?? '').trim();
    if (!raw) {
      throw new BitrixLeadsConfigError(
        `Переменная окружения ${key} обязательна для работы BitrixLeadsModule. ` +
          `Получите webhook URL: Битрикс24 → Приложения → Разработчикам → Входящий вебхук.`,
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new BitrixLeadsConfigError(
        `Переменная ${key}="${raw}" не является валидным URL.`,
      );
    }

    if (parsed.protocol !== 'https:') {
      throw new BitrixLeadsConfigError(
        `Переменная ${key} должна использовать https:// (получено: ${raw}).`,
      );
    }

    return raw;
  }
}
