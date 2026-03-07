import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// ─── Интерфейсы ─────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: string;   // user id
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;  // opaque random token, хранится как hash в БД
  refreshExpiresAt: Date;
}

// ─── Сервис ─────────────────────────────────────────────────────────────────

@Injectable()
export class TokenService {
  // TTL из окружения с разумными дефолтами
  private readonly accessSecret  = this.requireEnv('JWT_ACCESS_SECRET');
  private readonly accessTtlSec  = Number(process.env['JWT_ACCESS_TTL_SEC']  ?? 900);      // 15 мин
  private readonly refreshTtlSec = Number(process.env['JWT_REFRESH_TTL_SEC'] ?? 2592000);  // 30 дней

  // ─── Генерация пары токенов ──────────────────────────────────────────────

  generateTokenPair(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): TokenPair {
    const now = Math.floor(Date.now() / 1000);

    const accessToken = this.signJwt({
      ...payload,
      iat: now,
      exp: now + this.accessTtlSec,
    });

    const refreshToken     = randomBytes(48).toString('hex');   // 96-char opaque token
    const refreshExpiresAt = new Date((now + this.refreshTtlSec) * 1000);

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  // ─── Верификация access token ────────────────────────────────────────────

  verifyAccessToken(token: string): AccessTokenPayload {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed token');

    const [headerB64, payloadB64, signature] = parts;
    const expected = this.hmacSign(`${headerB64}.${payloadB64}`);

    if (!timingSafeEqual(Buffer.from(signature, 'base64url'), Buffer.from(expected, 'base64url'))) {
      throw new Error('Invalid token signature');
    }

    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as AccessTokenPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return payload;
  }

  // ─── JWT helper ─────────────────────────────────────────────────────────

  private signJwt(payload: AccessTokenPayload): string {
    const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body    = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig     = this.hmacSign(`${header}.${body}`);
    return `${header}.${body}.${sig}`;
  }

  private hmacSign(data: string): string {
    return createHmac('sha256', this.accessSecret).update(data).digest('base64url');
  }

  private requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`Environment variable ${key} is required`);
    return value;
  }
}
