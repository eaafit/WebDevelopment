import { Injectable, inject } from '@angular/core';
import { createClient } from '@connectrpc/connect';
import { AuthService as RpcAuthService, OauthProvider } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT, type RpcAuthUser } from '@notary-portal/ui';

/** Профиль локального Apple stub IdP (`GET /api/oauth/stub/apple/profile`). */
export interface AppleStubProfile {
  provider: string;
  sub: string;
  email: string;
  name: string;
}

export interface OAuthAuthorizeResult {
  url: string;
  state: string;
}

export interface OAuthLoginResult {
  accessToken?: string;
  refreshToken?: string;
  user?: RpcAuthUser;
  verificationRequired: boolean;
  verificationTicket: string;
  contactToVerify: string;
}

export interface ConfirmContactResult {
  accessToken: string;
  refreshToken: string;
  user?: RpcAuthUser;
}

/**
 * Чтение auth RPC-контракта и локального Apple IdP.
 * Компоненты этот сервис не трогают — только AuthService.
 */
@Injectable({ providedIn: 'root' })
export class OAuthApiService {
  private readonly transport = inject(RPC_TRANSPORT);
  private readonly client = createClient(RpcAuthService, this.transport);

  async getAuthorizeUrl(provider: OauthProvider): Promise<OAuthAuthorizeResult> {
    const res = await this.client.getOAuthAuthorizeUrl({ provider });
    return { url: res.url, state: res.state };
  }

  async oAuthLogin(input: {
    provider: OauthProvider;
    code: string;
    state: string;
    deviceId: string;
  }): Promise<OAuthLoginResult> {
    const res = await this.client.oAuthLogin(input);
    return {
      accessToken: res.result?.accessToken,
      refreshToken: res.result?.refreshToken,
      user: res.result?.user,
      verificationRequired: res.verificationRequired,
      verificationTicket: res.verificationTicket,
      contactToVerify: res.contactToVerify,
    };
  }

  async confirmContact(ticket: string, code: string): Promise<ConfirmContactResult> {
    const res = await this.client.confirmContact({ ticket, code });
    if (!res.result?.accessToken || !res.result.refreshToken) {
      throw new Error('Пустой ответ сервера');
    }
    return {
      accessToken: res.result.accessToken,
      refreshToken: res.result.refreshToken,
      user: res.result.user,
    };
  }

  async resendContactCode(ticket: string): Promise<void> {
    await this.client.resendContactCode({ ticket });
  }

  /** Локальная dev-заглушка для любого провайдера: если реальный сервис недоступен, возвращаем тестовый профиль. */
  async readStubProfile(providerKey: string, displayName = 'Provider'): Promise<AppleStubProfile> {
    try {
      const res = await fetch(`/api/oauth/stub/${providerKey}/profile`);
      if (!res.ok) throw new Error('stub unavailable');
      const data = (await res.json()) as Partial<AppleStubProfile>;
      const email = data.email?.trim() ?? '';
      const sub = data.sub?.trim() ?? '';
      if (!email || !sub) throw new Error('stub empty');
      return {
        provider: data.provider?.trim() || providerKey,
        sub,
        email,
        name: data.name?.trim() || `${displayName} Demo User`,
      };
    } catch {
      const email = `${providerKey}-demo@local.test`;
      return {
        provider: providerKey,
        sub: `${providerKey}-stub-user`,
        email,
        name: `${displayName} Demo User`,
      };
    }
  }

  /** Совместимость со старым кодом / тестами. */
  async readAppleStubProfile(): Promise<AppleStubProfile> {
    return this.readStubProfile('apple', 'Apple');
  }
}
