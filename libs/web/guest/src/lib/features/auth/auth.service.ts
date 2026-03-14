import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { createClient } from '@connectrpc/connect';

import { AuthService as RpcAuthService } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT, TokenStore, USER_ROLE_HOME } from '@notary-portal/ui';

const createRpcClient = createClient as unknown as (service: any, transport: any) => any;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenStore = inject(TokenStore);
  private readonly router = inject(Router);
  private readonly transport = inject(RPC_TRANSPORT);

  private readonly client = createRpcClient(RpcAuthService, this.transport);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Р”РµР»РµРіРёСЂСѓРµРј СЃРѕСЃС‚РѕСЏРЅРёРµ РІ TokenStore
  readonly user = this.tokenStore.user;
  readonly isLoggedIn = this.tokenStore.isLoggedIn;
  readonly role = this.tokenStore.role;
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // в”Ђв”Ђв”Ђ Login в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

  async login(email: string, password: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = await this.client['login']({ email, password });
      if (!res.result) throw new Error('РџСѓСЃС‚РѕР№ РѕС‚РІРµС‚ СЃРµСЂРІРµСЂР°');
      this.tokenStore.setTokens(res.result.accessToken, res.result.refreshToken, res.result.user);
      await this.router.navigateByUrl(USER_ROLE_HOME[this.tokenStore.role()!]);
    } catch (err) {
      this._error.set(extractMessage(err));
    } finally {
      this._loading.set(false);
    }
  }

  // в”Ђв”Ђв”Ђ Register в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

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
      const res = await this.client['register'](params);
      if (!res.result) throw new Error('РџСѓСЃС‚РѕР№ РѕС‚РІРµС‚ СЃРµСЂРІРµСЂР°');
      this.tokenStore.setTokens(res.result.accessToken, res.result.refreshToken, res.result.user);
      await this.router.navigateByUrl(USER_ROLE_HOME[this.tokenStore.role()!]);
    } catch (err) {
      this._error.set(extractMessage(err));
    } finally {
      this._loading.set(false);
    }
  }

  // в”Ђв”Ђв”Ђ Refresh (РІС‹Р·С‹РІР°РµС‚СЃСЏ РёР· RPC-РёРЅС‚РµСЂСЃРµРїС‚РѕСЂР°) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

  async refresh(): Promise<boolean> {
    const rt = this.tokenStore.getRefreshToken();
    if (!rt) return false;
    try {
      const res = await this.client['refreshToken']({ refreshToken: rt });
      if (!res.result) return false;
      this.tokenStore.setTokens(res.result.accessToken, res.result.refreshToken, res.result.user);
      return true;
    } catch {
      this.tokenStore.clear();
      return false;
    }
  }

  // в”Ђв”Ђв”Ђ Logout в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

  async logout(): Promise<void> {
    const rt = this.tokenStore.getRefreshToken();
    if (rt) {
      try {
        await this.client['logout']({ refreshToken: rt });
      } catch {
        /* idempotent */
      }
    }
    this.tokenStore.clear();
    await this.router.navigateByUrl('/');
  }

  // Р”Р»СЏ РёРЅС‚РµСЂСЃРµРїС‚РѕСЂР° (РіРµС‚С‚РµСЂ С‚РѕРєРµРЅР° Р±РµР· РѕР±СЂР°С‰РµРЅРёСЏ Рє СЃРµСЂРІРёСЃСѓ)
  getAccessToken(): string | null {
    return this.tokenStore.getAccessToken();
  }

  hasSession(): boolean {
    return this.tokenStore.hasSession();
  }
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'РќРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР°';
}
