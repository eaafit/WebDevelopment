import { Injectable, Logger } from '@nestjs/common';
import type { OAuthClient, OAuthCodeExchange } from './oauth-client';

/**
 * Низкоуровневый клиент Google OAuth2 / OpenID Connect.
 * Только сетевой обмен с Google — без бизнес-логики и без аудита.
 * Токены Google наружу не отдаются и не логируются (логируется только статус ответа).
 * @see https://developers.google.com/identity/protocols/oauth2/web-server
 */

const GOOGLE_AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_SCOPE = 'openid email profile';

export interface GoogleTokenResult {
  /** Короткоживущий access_token для запроса userinfo. Клиенту не отдаётся. */
  accessToken: string;
  /** id_token (JWT), если вернулся. Клиенту не отдаётся. */
  idToken: string | null;
}

export interface GoogleUserInfo {
  /** Стабильный идентификатор пользователя у Google (поле `sub`). */
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
}

/** Ошибка обмена с Google. Сообщение НЕ содержит code/token/secret. */
export class GoogleOAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GoogleOAuthError';
  }
}

@Injectable()
export class GoogleOAuthClient implements OAuthClient {
  private readonly logger = new Logger(GoogleOAuthClient.name);

  /** Собирает URL согласия Google. `state` уже подписан вызывающей стороной. */
  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPE,
      state,
      access_type: 'online',
      include_granted_scopes: 'true',
      prompt: 'select_account',
    });
    return `${GOOGLE_AUTHORIZE_ENDPOINT}?${params.toString()}`;
  }

  /** Меняет authorization code на токены Google (server-to-server). */
  async exchangeCode({ code }: OAuthCodeExchange): Promise<GoogleTokenResult> {
    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      // Логируем только статус — без тела (может содержать детали кода/секрета).
      this.logger.warn(`Google token exchange failed with status ${res.status}`);
      throw new GoogleOAuthError(`Google token exchange failed: ${res.status}`, res.status);
    }

    const data = (await res.json()) as { access_token?: string; id_token?: string };
    if (!data.access_token) {
      throw new GoogleOAuthError('Google token response is missing access_token');
    }

    return { accessToken: data.access_token, idToken: data.id_token ?? null };
  }

  /** Запрашивает профиль пользователя по access_token. */
  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      this.logger.warn(`Google userinfo request failed with status ${res.status}`);
      throw new GoogleOAuthError(`Google userinfo request failed: ${res.status}`, res.status);
    }

    const data = (await res.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
      name?: string;
    };

    if (!data.sub || !data.email) {
      throw new GoogleOAuthError('Google userinfo response is missing sub or email');
    }

    const email = data.email.trim().toLowerCase();
    return {
      providerUserId: data.sub,
      email,
      emailVerified: data.email_verified === true || data.email_verified === 'true',
      fullName: data.name?.trim() || email,
    };
  }

  private get clientId(): string {
    return this.requireEnv('GOOGLE_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.requireEnv('GOOGLE_CLIENT_SECRET');
  }

  private get redirectUri(): string {
    return this.requireEnv('GOOGLE_REDIRECT_URI');
  }

  private requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new GoogleOAuthError(`Environment variable ${key} is required for Google OAuth`);
    }
    return value;
  }
}
