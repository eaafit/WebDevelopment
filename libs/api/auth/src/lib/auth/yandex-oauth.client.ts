import { Injectable, Logger } from '@nestjs/common';
import {
  OAuthClientError,
  type OAuthClient,
  type OAuthCodeExchange,
  type OAuthTokens,
  type OAuthUserInfo,
} from './oauth-client';

/**
 * Низкоуровневый клиент Яндекс OAuth (authorization code, без PKCE).
 * Только сетевой обмен — без бизнес-логики и аудита. Токены наружу не отдаются.
 * @see https://yandex.ru/dev/id/doc/ru/concepts/ya-oauth-intro
 */

const YANDEX_AUTHORIZE_ENDPOINT = 'https://oauth.yandex.ru/authorize';
const YANDEX_TOKEN_ENDPOINT = 'https://oauth.yandex.ru/token';
const YANDEX_USERINFO_ENDPOINT = 'https://login.yandex.ru/info';
// login:email — доступ к default_email; login:info — логин/имя/фамилия.
const YANDEX_SCOPE = 'login:email login:info';

@Injectable()
export class YandexOAuthClient implements OAuthClient {
  private readonly logger = new Logger(YandexOAuthClient.name);

  /** Собирает URL согласия Яндекса. `state` уже подписан вызывающей стороной. */
  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: YANDEX_SCOPE,
      state,
      // Всегда показывать экран подтверждения (удобно для повторного входа в демо).
      force_confirm: 'yes',
    });
    return `${YANDEX_AUTHORIZE_ENDPOINT}?${params.toString()}`;
  }

  /** Меняет authorization code на токены Яндекса (server-to-server). */
  async exchangeCode({ code }: OAuthCodeExchange): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await fetch(YANDEX_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      this.logger.warn(`Yandex token exchange failed with status ${res.status}`);
      throw new OAuthClientError(`Yandex token exchange failed: ${res.status}`, res.status);
    }

    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) {
      throw new OAuthClientError('Yandex token response is missing access_token');
    }

    return { accessToken: data.access_token };
  }

  /** Запрашивает профиль пользователя Яндекса по access_token. */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const res = await fetch(`${YANDEX_USERINFO_ENDPOINT}?format=json`, {
      headers: { Authorization: `OAuth ${accessToken}` },
    });

    if (!res.ok) {
      this.logger.warn(`Yandex userinfo request failed with status ${res.status}`);
      throw new OAuthClientError(`Yandex userinfo request failed: ${res.status}`, res.status);
    }

    const data = (await res.json()) as {
      id?: string;
      default_email?: string;
      real_name?: string;
      display_name?: string;
      login?: string;
    };

    if (!data.id) {
      throw new OAuthClientError('Yandex userinfo response is missing id');
    }

    const email = (data.default_email ?? '').trim().toLowerCase();
    const fullName = (data.real_name || data.display_name || data.login || email).trim();

    return {
      providerUserId: data.id,
      email,
      // Яндекс отдаёт уже подтверждённый default_email; пустой email → обработка no_email выше.
      emailVerified: email.length > 0,
      fullName,
    };
  }

  private get clientId(): string {
    return this.requireEnv('YANDEX_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.requireEnv('YANDEX_CLIENT_SECRET');
  }

  private get redirectUri(): string {
    return this.requireEnv('YANDEX_REDIRECT_URI');
  }

  private requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new OAuthClientError(`Environment variable ${key} is required for Yandex OAuth`);
    }
    return value;
  }
}
