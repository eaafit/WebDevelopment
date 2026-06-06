import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import {
  OAuthClientError,
  type OAuthClient,
  type OAuthCodeExchange,
  type OAuthPkce,
  type OAuthTokens,
  type OAuthUserInfo,
} from './oauth-client';

/**
 * Низкоуровневый клиент VK ID (OAuth 2.1 + PKCE).
 * Отличия от Google/Yandex: обязателен PKCE (code_verifier/code_challenge S256)
 * и device_id, выдаваемый VK на callback и нужный при обмене кода на токен.
 * Только сетевой обмен — без бизнес-логики и аудита; токены наружу не отдаются.
 * @see https://id.vk.ru/about/business/go/docs/ru/vkid/latest/vk-id/connection/api-integration
 */

const VK_AUTHORIZE_ENDPOINT = 'https://id.vk.ru/authorize';
const VK_TOKEN_ENDPOINT = 'https://id.vk.ru/oauth2/auth';
const VK_USERINFO_ENDPOINT = 'https://id.vk.ru/oauth2/user_info';
const VK_SCOPE = 'email';

@Injectable()
export class VkOAuthClient implements OAuthClient {
  private readonly logger = new Logger(VkOAuthClient.name);

  /** Генерирует PKCE-пару: verifier (43–128 симв.) + challenge = base64url(SHA-256(verifier)). */
  createPkce(): OAuthPkce {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  /** Собирает URL согласия VK ID. `state` подписан вызывающей стороной; `codeChallenge` обязателен. */
  buildAuthorizeUrl(state: string, codeChallenge?: string): string {
    if (!codeChallenge) {
      throw new OAuthClientError('VK ID requires a PKCE code_challenge');
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: VK_SCOPE,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${VK_AUTHORIZE_ENDPOINT}?${params.toString()}`;
  }

  /** Меняет authorization code на токены VK (server-to-server, PKCE + device_id). */
  async exchangeCode({ code, codeVerifier, deviceId }: OAuthCodeExchange): Promise<OAuthTokens> {
    if (!codeVerifier) {
      throw new OAuthClientError('VK ID requires a PKCE code_verifier');
    }
    if (!deviceId) {
      throw new OAuthClientError('VK ID requires a device_id from the callback');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      client_id: this.clientId,
      device_id: deviceId,
      redirect_uri: this.redirectUri,
    });
    // Конфиденциальным клиентам VK может потребоваться client_secret (опционально).
    const clientSecret = process.env['VK_CLIENT_SECRET'];
    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }

    const res = await fetch(VK_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      this.logger.warn(`VK token exchange failed with status ${res.status}`);
      throw new OAuthClientError(`VK token exchange failed: ${res.status}`, res.status);
    }

    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) {
      throw new OAuthClientError('VK token response is missing access_token');
    }

    return { accessToken: data.access_token };
  }

  /** Запрашивает профиль пользователя VK по access_token. */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      access_token: accessToken,
    });

    const res = await fetch(VK_USERINFO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      this.logger.warn(`VK userinfo request failed with status ${res.status}`);
      throw new OAuthClientError(`VK userinfo request failed: ${res.status}`, res.status);
    }

    const data = (await res.json()) as {
      user?: {
        user_id?: string;
        first_name?: string;
        last_name?: string;
        email?: string;
      };
    };

    const user = data.user;
    if (!user?.user_id) {
      throw new OAuthClientError('VK userinfo response is missing user_id');
    }

    const email = (user.email ?? '').trim().toLowerCase();
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || email;

    return {
      providerUserId: user.user_id,
      email,
      // VK отдаёт уже подтверждённый email; пустой email → обработка no_email выше.
      emailVerified: email.length > 0,
      fullName,
    };
  }

  private get clientId(): string {
    return this.requireEnv('VK_CLIENT_ID');
  }

  private get redirectUri(): string {
    return this.requireEnv('VK_REDIRECT_URI');
  }

  private requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new OAuthClientError(`Environment variable ${key} is required for VK OAuth`);
    }
    return value;
  }
}
