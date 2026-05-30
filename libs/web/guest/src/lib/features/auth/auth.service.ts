import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { createClient } from '@connectrpc/connect';
import { AuthService as RpcAuthService } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT, TokenStore, USER_ROLE_HOME, WebLoggerService } from '@notary-portal/ui';
import {
  authErrorLogContext,
  authRoleName,
  buildAuthLogContext,
  emailDomainOf,
  isExpectedAuthError,
  type AuthBrowserLogContext,
} from './auth-browser-log';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenStore = inject(TokenStore);
  private readonly router = inject(Router);
  private readonly transport = inject(RPC_TRANSPORT);
  private readonly logger = inject(WebLoggerService);

  private readonly client = createClient(RpcAuthService, this.transport);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Делегируем состояние в TokenStore
  readonly user = this.tokenStore.user;
  readonly isLoggedIn = this.tokenStore.isLoggedIn;
  readonly role = this.tokenStore.role;
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // ─── Login ───────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<void> {
    const logContext = this.baseAuthLogContext(email);
    this.logger.info('auth.login.submitted', {
      ...logContext,
      outcome: 'submitted',
    });
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = await this.client.login({ email, password });
      if (!res.result) throw new Error('Пустой ответ сервера');
      this.tokenStore.setTokens(res.result.accessToken, res.result.refreshToken, res.result.user);
      this.logger.info('auth.login.succeeded', {
        ...logContext,
        outcome: 'succeeded',
        role: authRoleName(this.tokenStore.role() ?? undefined),
      });
      await this.router.navigateByUrl(USER_ROLE_HOME[this.tokenStore.role()!]);
    } catch (err) {
      this.logAuthFailure('auth.login.failed', err, logContext);
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
    const logContext = this.baseAuthLogContext(params.email, {
      role: authRoleName(params.role),
    });
    this.logger.info('auth.register.submitted', {
      ...logContext,
      outcome: 'submitted',
    });
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = await this.client.register(params);
      if (!res.result) throw new Error('Пустой ответ сервера');
      this.tokenStore.setTokens(res.result.accessToken, res.result.refreshToken, res.result.user);
      this.logger.info('auth.register.succeeded', {
        ...logContext,
        outcome: 'succeeded',
        role: authRoleName(this.tokenStore.role() ?? params.role),
      });
      await this.router.navigateByUrl(USER_ROLE_HOME[this.tokenStore.role()!]);
    } catch (err) {
      this.logAuthFailure('auth.register.failed', err, logContext);
      this._error.set(extractMessage(err));
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
    const logContext = this.baseAuthLogContext(email);
    this.logger.info('auth.password_reset.request_submitted', {
      ...logContext,
      outcome: 'submitted',
    });
    this._loading.set(true);
    this._error.set(null);
    try {
      await this.client.forgotPassword({ email: email.trim() });
      this.logger.info('auth.password_reset.request_succeeded', {
        ...logContext,
        outcome: 'succeeded',
      });
    } catch (err) {
      this.logAuthFailure('auth.password_reset.request_failed', err, logContext);
      this._error.set(extractMessage(err));
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const logContext = this.baseAuthLogContext();
    this.logger.info('auth.password_reset.submit_submitted', {
      ...logContext,
      outcome: 'submitted',
    });
    this._loading.set(true);
    this._error.set(null);
    try {
      await this.client.resetPassword({ token, newPassword });
      this.logger.info('auth.password_reset.submit_succeeded', {
        ...logContext,
        outcome: 'succeeded',
      });
    } catch (err) {
      this.logAuthFailure('auth.password_reset.submit_failed', err, logContext);
      this._error.set(extractMessage(err));
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async logout(): Promise<void> {
    const rt = this.tokenStore.getRefreshToken();
    if (rt) {
      try {
        await this.client.logout({ refreshToken: rt });
      } catch {
        /* idempotent */
      }
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

  private baseAuthLogContext(
    email?: string,
    extra: AuthBrowserLogContext = {},
  ): AuthBrowserLogContext {
    return buildAuthLogContext({
      emailDomain: emailDomainOf(email),
      hasSession: this.tokenStore.hasSession(),
      route: this.router.url,
      ...extra,
    });
  }

  private logAuthFailure(event: string, error: unknown, context: AuthBrowserLogContext): void {
    const payload = buildAuthLogContext({
      ...context,
      ...authErrorLogContext(error),
      outcome: 'failed',
    });

    if (isExpectedAuthError(error)) {
      this.logger.warn(event, payload);
      return;
    }

    this.logger.error(event, payload);
  }
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Неизвестная ошибка';
}
