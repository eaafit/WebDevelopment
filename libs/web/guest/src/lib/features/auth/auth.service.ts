import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { createClient } from '@connectrpc/connect';
import { AuthService as RpcAuthService, OauthProvider } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT, TokenStore, USER_ROLE_HOME, WebLoggerService } from '@notary-portal/ui';

/** Ключ sessionStorage для сверки OAuth state на callback (defense-in-depth против CSRF). */
const OAUTH_STATE_KEY = 'oauth_state';

/** Ключи sessionStorage для шага подтверждения контакта после OAuth. */
const VERIFY_TICKET_KEY = 'oauth_verify_ticket';
const VERIFY_CONTACT_KEY = 'oauth_verify_contact';
const VERIFY_PROVIDER_KEY = 'oauth_verify_provider';

/** Данные ожидающего подтверждения контакта (для формы /auth/verify-contact). */
export interface PendingVerification {
  ticket: string;
  contact: string;
  providerKey: string;
}

/** Конфигурация внешнего OAuth-провайдера на фронте. */
export interface OAuthProviderConfig {
  provider: OauthProvider;
  /** Ключ маршрута /auth/oauth/:provider/callback и префикс лог-событий oauth.<key>.* */
  key: string;
  /** Человекочитаемое имя провайдера для UI (заголовки, сообщения). */
  displayName: string;
}

/** Реестр провайдеров по ключу маршрута. Новый провайдер = новая запись. */
export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  google: { provider: OauthProvider.GOOGLE, key: 'google', displayName: 'Google' },
  yandex: { provider: OauthProvider.YANDEX, key: 'yandex', displayName: 'Яндекс' },
  vk: { provider: OauthProvider.VK, key: 'vk', displayName: 'ВКонтакте' },
};

/** Конфигурация провайдера по ключу маршрута, либо null для неизвестного. */
export function resolveOAuthProvider(key: string | null | undefined): OAuthProviderConfig | null {
  if (!key) return null;
  return OAUTH_PROVIDERS[key] ?? null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenStore = inject(TokenStore);
  private readonly router     = inject(Router);
  private readonly transport  = inject(RPC_TRANSPORT);
  private readonly logger     = inject(WebLoggerService);

  private readonly client = createClient(RpcAuthService, this.transport);

  private readonly _loading = signal(false);
  private readonly _error   = signal<string | null>(null);

  // Делегируем состояние в TokenStore
  readonly user       = this.tokenStore.user;
  readonly isLoggedIn = this.tokenStore.isLoggedIn;
  readonly role       = this.tokenStore.role;
  readonly loading    = this._loading.asReadonly();
  readonly error      = this._error.asReadonly();

  // ─── Login ───────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = await this.client.login({ email, password });
      if (!res.result) throw new Error('Пустой ответ сервера');
      this.tokenStore.setTokens(res.result.accessToken, res.result.refreshToken, res.result.user);
      await this.router.navigateByUrl(USER_ROLE_HOME[this.tokenStore.role()!]);
    } catch (err) {
      this._error.set(extractMessage(err));
    } finally {
      this._loading.set(false);
    }
  }

  // ─── Register ────────────────────────────────────────────────────────────

  async register(params: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber?: string;
    role: number;
  }): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = await this.client.register(params);
      if (!res.result) throw new Error('Пустой ответ сервера');
      this.tokenStore.setTokens(res.result.accessToken, res.result.refreshToken, res.result.user);
      await this.router.navigateByUrl(USER_ROLE_HOME[this.tokenStore.role()!]);
    } catch (err) {
      this._error.set(extractMessage(err));
    } finally {
      this._loading.set(false);
    }
  }

  // ─── OAuth (Google / Яндекс / ВК) ─────────────────────────────────────────

  /**
   * Старт входа через внешний провайдер: получает authorize URL с подписанным
   * state, сохраняет state в sessionStorage и возвращает URL для редиректа браузера.
   */
  async getAuthorizeUrl(config: OAuthProviderConfig): Promise<string> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = await this.client.getOAuthAuthorizeUrl({ provider: config.provider });
      if (!res.url || !res.state) throw new Error('Пустой ответ сервера');
      this.persistOAuthState(res.state);
      this.logger.info(`oauth.${config.key}.authorize_requested`, { provider: config.key });
      return res.url;
    } catch (err) {
      this._error.set(extractMessage(err));
      this.logger.warn(`oauth.${config.key}.authorize_failed`, { provider: config.key });
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Завершение входа на callback: сверяет state с сохранённым, отправляет
   * code/state на бэкенд, на успехе сохраняет токены и редиректит по роли.
   * Возвращает true при успешном входе.
   */
  async completeOAuthLogin(
    config: OAuthProviderConfig,
    code: string,
    state: string,
    deviceId = '',
  ): Promise<boolean> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const expected = this.readOAuthState();
      this.clearOAuthState();
      if (!code || !state || !expected || state !== expected) {
        throw new Error('Некорректный ответ авторизации.');
      }
      // device_id нужен только VK ID; Google/Yandex его не присылают (пустая строка).
      const res = await this.client.oAuthLogin({ provider: config.provider, code, state, deviceId });

      // Новая регистрация / первая связка → шаг подтверждения контакта (токены не выдаются).
      if (res.verificationRequired) {
        this.persistPendingVerification({
          ticket: res.verificationTicket,
          contact: res.contactToVerify,
          providerKey: config.key,
        });
        this.logger.info(`oauth.${config.key}.verification_required`, { provider: config.key });
        await this.router.navigateByUrl('/auth/verify-contact');
        return true;
      }

      if (!res.result) throw new Error('Пустой ответ сервера');
      this.tokenStore.setTokens(res.result.accessToken, res.result.refreshToken, res.result.user);
      this.logger.info(`oauth.${config.key}.login_succeeded`, { provider: config.key });
      await this.router.navigateByUrl(USER_ROLE_HOME[this.tokenStore.role()!]);
      return true;
    } catch (err) {
      this._error.set(extractMessage(err));
      this.logger.warn(`oauth.${config.key}.login_failed`, { provider: config.key });
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  private persistOAuthState(state: string): void {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(OAUTH_STATE_KEY, state);
  }

  private readOAuthState(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(OAUTH_STATE_KEY);
  }

  private clearOAuthState(): void {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(OAUTH_STATE_KEY);
  }

  // ─── Подтверждение контакта (после OAuth-регистрации / первой связки) ─────

  private persistPendingVerification(p: PendingVerification): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(VERIFY_TICKET_KEY, p.ticket);
    sessionStorage.setItem(VERIFY_CONTACT_KEY, p.contact);
    sessionStorage.setItem(VERIFY_PROVIDER_KEY, p.providerKey);
  }

  /** Данные ожидающего подтверждения (или null, если шага нет) — для формы и guard'а. */
  getPendingVerification(): PendingVerification | null {
    if (typeof sessionStorage === 'undefined') return null;
    const ticket = sessionStorage.getItem(VERIFY_TICKET_KEY);
    if (!ticket) return null;
    return {
      ticket,
      contact: sessionStorage.getItem(VERIFY_CONTACT_KEY) ?? '',
      providerKey: sessionStorage.getItem(VERIFY_PROVIDER_KEY) ?? '',
    };
  }

  private clearPendingVerification(): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(VERIFY_TICKET_KEY);
    sessionStorage.removeItem(VERIFY_CONTACT_KEY);
    sessionStorage.removeItem(VERIFY_PROVIDER_KEY);
  }

  /** Подтверждает контакт кодом. На успехе сохраняет токены и редиректит по роли. */
  async confirmContact(code: string): Promise<boolean> {
    const pending = this.getPendingVerification();
    if (!pending) {
      this._error.set('Сессия подтверждения истекла. Войдите ещё раз.');
      return false;
    }
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = await this.client.confirmContact({ ticket: pending.ticket, code });
      if (!res.result) throw new Error('Пустой ответ сервера');
      this.clearPendingVerification();
      this.tokenStore.setTokens(res.result.accessToken, res.result.refreshToken, res.result.user);
      this.logger.info('oauth.contact_confirmed', { provider: pending.providerKey });
      await this.router.navigateByUrl(USER_ROLE_HOME[this.tokenStore.role()!]);
      return true;
    } catch (err) {
      this._error.set(extractMessage(err));
      this.logger.warn('oauth.contact_confirmation_failed', { provider: pending.providerKey });
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  /** Повторная отправка кода (новый код в логе api). Серверный кулдаун защищает от спама. */
  async resendContactCode(): Promise<boolean> {
    const pending = this.getPendingVerification();
    if (!pending) {
      this._error.set('Сессия подтверждения истекла. Войдите ещё раз.');
      return false;
    }
    this._loading.set(true);
    this._error.set(null);
    try {
      await this.client.resendContactCode({ ticket: pending.ticket });
      this.logger.info('oauth.contact_code_resent', { provider: pending.providerKey });
      return true;
    } catch (err) {
      this._error.set(extractMessage(err));
      return false;
    } finally {
      this._loading.set(false);
    }
  }

  // ─── Refresh (вызывается из RPC-интерсептора) ─────────────────────────────

  async refresh(): Promise<boolean> {
    const rt = this.tokenStore.getRefreshToken();
    if (!rt) return false;
    try {
      const res = await this.client.refreshToken({ refreshToken: rt });
      if (!res.result) return false;
      this.tokenStore.setTokens(res.result.accessToken, res.result.refreshToken, res.result.user);
      return true;
    } catch {
      this.tokenStore.clear();
      return false;
    }
  }

  // ─── Logout ──────────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      await this.client.forgotPassword({ email: email.trim() });
    } catch (err) {
      this._error.set(extractMessage(err));
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      await this.client.resetPassword({ token, newPassword });
    } catch (err) {
      this._error.set(extractMessage(err));
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async logout(): Promise<void> {
    const rt = this.tokenStore.getRefreshToken();
    if (rt) {
      try { await this.client.logout({ refreshToken: rt }); } catch { /* idempotent */ }
    }
    this.tokenStore.clear();
    await this.router.navigateByUrl('/');
  }

  // Для интерсептора (геттер токена без обращения к сервису)
  getAccessToken(): string | null {
    return this.tokenStore.getAccessToken();
  }

  hasSession(): boolean {
    return this.tokenStore.hasSession();
  }
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Неизвестная ошибка';
}
