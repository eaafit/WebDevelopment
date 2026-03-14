import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { createClient } from '@connectrpc/connect';
import { AuthService as RpcAuthService } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT, TokenStore, USER_ROLE_HOME } from '@notary-portal/ui';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenStore = inject(TokenStore);
  private readonly router = inject(Router);
  private readonly transport = inject(RPC_TRANSPORT);

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
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Неизвестная ошибка';
}
