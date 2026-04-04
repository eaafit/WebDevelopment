import {
  InjectionToken,
  inject,
  type EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';
import { Router } from '@angular/router';
import { createConnectTransport } from '@connectrpc/connect-web';
import { type Interceptor, type Transport } from '@connectrpc/connect';

// ─── InjectionToken ──────────────────────────────────────────────────────────

export const RPC_TRANSPORT = new InjectionToken<Transport>('RPC_TRANSPORT');

// ─── Base URL ────────────────────────────────────────────────────────────────

export function buildRpcBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  const { hostname, port, origin } = window.location;
  const isLocal = ['localhost', '127.0.0.1'].includes(hostname);
  return isLocal && port !== '3000' ? `http://${hostname}:3000` : origin;
}

// ─── Фабрика провайдера ──────────────────────────────────────────────────────
// Вызывается в app.config.ts: provideRpcTransport()
//
// Принимает getAccessToken / refreshFn / router — инжектированные снаружи,
// чтобы не создавать циклическую зависимость TokenStore ↔ Transport.

export interface RpcTransportOptions {
  /** Функция возвращает актуальный access token или null */
  getToken: () => string | null;
  /** Функция пробует обновить токен; возвращает true если успешно */
  refresh: () => Promise<boolean>;
  /** Если refresh провалился — редирект на этот путь */
  loginPath?: string;
}

export type RpcTransportOptionsFactory = () => RpcTransportOptions;

export function createAuthInterceptor(opts: RpcTransportOptions, router: Router): Interceptor {
  return (next) => async (req) => {
    // Пропускаем публичные методы auth-сервиса — у них нет токена
    const isPublic = req.url.includes('/notary.auth.v1alpha1.AuthService/');
    if (isPublic) return next(req);

    let token = opts.getToken();

    // Если токена нет но есть refresh token — пробуем тихое обновление
    if (!token) {
      const ok = await opts.refresh();
      if (!ok) {
        await router.navigateByUrl(opts.loginPath ?? '/auth');
        throw new Error('Session expired');
      }
      token = opts.getToken();
    }

    if (token) {
      req.header.set('Authorization', `Bearer ${token}`);
    }

    return next(req);
  };
}

export function provideRpcTransport(
  optsOrFactory: RpcTransportOptions | RpcTransportOptionsFactory,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: RPC_TRANSPORT,
      useFactory: () => {
        const router = inject(Router);
        const opts = typeof optsOrFactory === 'function' ? optsOrFactory() : optsOrFactory;

        return createConnectTransport({
          baseUrl: buildRpcBaseUrl(),
          interceptors: [createAuthInterceptor(opts, router)],
        });
      },
    },
  ]);
}
