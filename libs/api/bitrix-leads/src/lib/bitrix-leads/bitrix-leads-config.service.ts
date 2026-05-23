import { Injectable } from '@nestjs/common';

export class BitrixLeadsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BitrixLeadsConfigError';
  }
}

/**
 * Поведение:
 *  - Если переменная отсутствует или пустая → значение `null`, `isConfigured()` вернёт false.
 *    Backend стартует нормально, publisher тихо пропускает публикацию.
 *  - Если переменная задана, но невалидна (не URL / не https) → throw в конструкторе.
 *    Это «fail fast» — кривой webhook лучше отлавливать на старте, а не в проде при первой заявке.
 */
@Injectable()
export class BitrixLeadsConfigService {
  private readonly webhookUrl: string | null = this.tryReadUrl('BITRIX_WEBHOOK_URL');
  private readonly portalUrl: string | null = this.tryReadUrl('BITRIX_PORTAL_URL');

  isConfigured(): boolean {
    return this.webhookUrl !== null && this.portalUrl !== null;
  }

  getWebhookUrl(): string {
    if (this.webhookUrl === null) {
      throw new BitrixLeadsConfigError(this.missingEnvMessage('BITRIX_WEBHOOK_URL'));
    }
    return this.webhookUrl;
  }

  getPortalUrl(): string {
    if (this.portalUrl === null) {
      throw new BitrixLeadsConfigError(this.missingEnvMessage('BITRIX_PORTAL_URL'));
    }
    return this.portalUrl;
  }

  private tryReadUrl(key: string): string | null {
    const raw = (process.env[key] ?? '').trim();
    if (!raw) {
      return null;
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

  private missingEnvMessage(key: string): string {
    return (
      `Переменная окружения ${key} обязательна для работы BitrixLeadsModule. ` +
      `Получите webhook URL: Битрикс24 → Приложения → Разработчикам → Входящий вебхук.`
    );
  }
}
