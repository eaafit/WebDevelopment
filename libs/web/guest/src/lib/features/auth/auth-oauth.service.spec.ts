import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RPC_TRANSPORT, TokenStore, WebLoggerService } from '@notary-portal/ui';
import { AuthService, OAUTH_PROVIDERS } from './auth.service';

function makeJwt(payload: object): string {
  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64url({ alg: 'HS256' })}.${b64url(payload)}.sig`;
}

const NOW = Math.floor(Date.now() / 1000);
const TOKEN = makeJwt({ sub: 'u1', email: 'a@b.com', role: '1', iat: NOW, exp: NOW + 900 });

describe('AuthService — OAuth (Google / Яндекс)', () => {
  const client = { getOAuthAuthorizeUrl: jest.fn(), oAuthLogin: jest.fn() };
  const router = { navigateByUrl: jest.fn() };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

  let service: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: RPC_TRANSPORT, useValue: {} },
        { provide: Router, useValue: router },
        { provide: WebLoggerService, useValue: logger },
      ],
    });
    service = TestBed.inject(AuthService);
    TestBed.inject(TokenStore).clear();
    // Подменяем приватный connect-клиент моком.
    (service as unknown as { client: typeof client }).client = client;
  });

  describe('getAuthorizeUrl', () => {
    it('persists state in sessionStorage and returns the Google authorize URL', async () => {
      client.getOAuthAuthorizeUrl.mockResolvedValue({ url: 'https://google/auth?x=1', state: 'st-123' });

      const url = await service.getAuthorizeUrl(OAUTH_PROVIDERS['google']);

      expect(url).toBe('https://google/auth?x=1');
      expect(sessionStorage.getItem('oauth_state')).toBe('st-123');
      expect(logger.info).toHaveBeenCalledWith(
        'oauth.google.authorize_requested',
        { provider: 'google' },
      );
    });

    it('uses the Yandex provider and logs a yandex-scoped event', async () => {
      client.getOAuthAuthorizeUrl.mockResolvedValue({ url: 'https://ya/auth?x=1', state: 'st-ya' });

      const url = await service.getAuthorizeUrl(OAUTH_PROVIDERS['yandex']);

      expect(url).toBe('https://ya/auth?x=1');
      expect(client.getOAuthAuthorizeUrl).toHaveBeenCalledWith({
        provider: OAUTH_PROVIDERS['yandex'].provider,
      });
      expect(logger.info).toHaveBeenCalledWith(
        'oauth.yandex.authorize_requested',
        { provider: 'yandex' },
      );
    });

    it('sets an error and rethrows when the RPC fails', async () => {
      client.getOAuthAuthorizeUrl.mockRejectedValue(new Error('rpc down'));
      await expect(service.getAuthorizeUrl(OAUTH_PROVIDERS['google'])).rejects.toThrow('rpc down');
      expect(service.error()).toBe('rpc down');
      expect(logger.warn).toHaveBeenCalledWith('oauth.google.authorize_failed', { provider: 'google' });
    });
  });

  describe('completeOAuthLogin', () => {
    it('logs in and redirects by role when state matches', async () => {
      sessionStorage.setItem('oauth_state', 'st-xyz');
      client.oAuthLogin.mockResolvedValue({
        result: {
          accessToken: TOKEN,
          refreshToken: 'rt',
          user: { id: 'u1', email: 'a@b.com', fullName: 'A', role: 1, phoneNumber: '', isActive: true },
        },
      });

      const ok = await service.completeOAuthLogin(OAUTH_PROVIDERS['google'], 'auth-code', 'st-xyz');

      expect(ok).toBe(true);
      expect(client.oAuthLogin).toHaveBeenCalledWith({
        provider: OAUTH_PROVIDERS['google'].provider,
        code: 'auth-code',
        state: 'st-xyz',
      });
      expect(router.navigateByUrl).toHaveBeenCalledWith('/applicant');
      expect(service.isLoggedIn()).toBe(true);
      expect(sessionStorage.getItem('oauth_state')).toBeNull();
    });

    it('rejects a mismatched state without calling the backend', async () => {
      sessionStorage.setItem('oauth_state', 'expected');

      const ok = await service.completeOAuthLogin(OAUTH_PROVIDERS['yandex'], 'auth-code', 'tampered');

      expect(ok).toBe(false);
      expect(client.oAuthLogin).not.toHaveBeenCalled();
      expect(service.error()).toBeTruthy();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });
});
