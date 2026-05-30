import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/** Ошибка проверки OAuth state (CSRF). */
export class OAuthStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthStateError';
  }
}

/**
 * Stateless CSRF-state для OAuth: подписанный HMAC токен `base64url(nonce.expiry).sig`.
 * Отдельной таблицы не требует; фронт дополнительно сверяет state из sessionStorage.
 *
 * Секрет: `OAUTH_STATE_SECRET`. Если он не задан — fallback на `JWT_ACCESS_SECRET`
 * ТОЛЬКО вне прода (с предупреждением). В проде отсутствие секрета — fail-fast.
 */
@Injectable()
export class OAuthStateService {
  private readonly logger = new Logger(OAuthStateService.name);
  private readonly ttlSec = Number(process.env['OAUTH_STATE_TTL_SEC'] ?? 600); // 10 минут

  /** Выпускает подписанный state со сроком жизни. */
  issue(): string {
    const nonce = randomBytes(16).toString('hex');
    const expiry = Math.floor(Date.now() / 1000) + this.ttlSec;
    const payload = `${nonce}.${expiry}`;
    const signature = this.sign(payload);
    return `${Buffer.from(payload).toString('base64url')}.${signature}`;
  }

  /** Проверяет подпись и срок. Бросает {@link OAuthStateError} при любой невалидности. */
  verify(state: string | null | undefined): void {
    if (!state) {
      throw new OAuthStateError('state is required');
    }

    const parts = state.split('.');
    if (parts.length !== 2) {
      throw new OAuthStateError('malformed state');
    }

    const [payloadB64, signature] = parts;
    const payload = Buffer.from(payloadB64, 'base64url').toString('utf8');

    if (!this.safeEqual(signature, this.sign(payload))) {
      throw new OAuthStateError('invalid state signature');
    }

    const expiry = Number(payload.split('.')[1]);
    if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) {
      throw new OAuthStateError('state expired');
    }
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.resolveSecret()).update(payload).digest('base64url');
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) {
      return false;
    }
    return timingSafeEqual(ab, bb);
  }

  private resolveSecret(): string {
    const explicit = process.env['OAUTH_STATE_SECRET'];
    if (explicit) {
      return explicit;
    }

    if (process.env['NODE_ENV'] === 'production') {
      throw new OAuthStateError('OAUTH_STATE_SECRET is required in production');
    }

    const fallback = process.env['JWT_ACCESS_SECRET'];
    if (!fallback) {
      throw new OAuthStateError(
        'OAUTH_STATE_SECRET is required (or JWT_ACCESS_SECRET for local development)',
      );
    }

    this.logger.warn(
      'OAUTH_STATE_SECRET не задан, использую JWT_ACCESS_SECRET — только для разработки',
    );
    return fallback;
  }
}
