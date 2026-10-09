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
  const client = {
    getOAuthAuthorizeUrl: jest.fn(),
    oAuthLogin: jest.fn(),
    confirmContact: jest.fn(),
    resendContactCode: jest.fn(),
  };
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
        deviceId: '',
      });
      expect(router.navigateByUrl).toHaveBeenCalledWith('/applicant');
      expect(service.isLoggedIn()).toBe(true);
      expect(sessionStorage.getItem('oauth_state')).toBeNull();
    });

    it('forwards the VK device_id to the backend', async () => {
      sessionStorage.setItem('oauth_state', 'st-vk');
      client.oAuthLogin.mockResolvedValue({
        result: {
          accessToken: TOKEN,
          refreshToken: 'rt',
          user: { id: 'u2', email: 'v@vk.com', fullName: 'V', role: 1, phoneNumber: '', isActive: true },
        },
      });

      const ok = await service.completeOAuthLogin(
        OAUTH_PROVIDERS['vk'],
        'vk-code',
        'st-vk',
        'device-77',
      );

      expect(ok).toBe(true);
      expect(client.oAuthLogin).toHaveBeenCalledWith({
        provider: OAUTH_PROVIDERS['vk'].provider,
        code: 'vk-code',
        state: 'st-vk',
        deviceId: 'device-77',
      });
    });

    it('rejects a mismatched state without calling the backend', async () => {
      sessionStorage.setItem('oauth_state', 'expected');

      const ok = await service.completeOAuthLogin(OAUTH_PROVIDERS['yandex'], 'auth-code', 'tampered');

      expect(ok).toBe(false);
      expect(client.oAuthLogin).not.toHaveBeenCalled();
      expect(service.error()).toBeTruthy();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('routes to the contact-verification form when verification is required', async () => {
      sessionStorage.setItem('oauth_state', 'st-ver');
      client.oAuthLogin.mockResolvedValue({
        verificationRequired: true,
        verificationTicket: 'ticket-abc',
        contactToVerify: 'new@user.com',
      });

      const ok = await service.completeOAuthLogin(OAUTH_PROVIDERS['google'], 'auth-code', 'st-ver');

      expect(ok).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/auth/verify-contact');
      expect(service.isLoggedIn()).toBe(false); // токены не выданы
      expect(service.getPendingVerification()).toEqual({
        ticket: 'ticket-abc',
        contact: 'new@user.com',
        providerKey: 'google',
      });
    });
  });

  describe('confirmContact / resendContactCode', () => {
    function setPending(): void {
      sessionStorage.setItem('oauth_verify_ticket', 'ticket-abc');
      sessionStorage.setItem('oauth_verify_contact', 'new@user.com');
      sessionStorage.setItem('oauth_verify_provider', 'google');
    }

    it('confirms the code, stores tokens, clears pending and redirects', async () => {
      setPending();
      client.confirmContact.mockResolvedValue({
        result: {
          accessToken: TOKEN,
          refreshToken: 'rt',
          user: { id: 'u1', email: 'new@user.com', fullName: 'N', role: 1, phoneNumber: '', isActive: true },
        },
      });

      const ok = await service.confirmContact('123456');

      expect(ok).toBe(true);
      expect(client.confirmContact).toHaveBeenCalledWith({ ticket: 'ticket-abc', code: '123456' });
      expect(service.isLoggedIn()).toBe(true);
      expect(service.getPendingVerification()).toBeNull();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/applicant');
    });

    it('reports an error and stays out when there is no pending verification', async () => {
      const ok = await service.confirmContact('123456');

      expect(ok).toBe(false);
      expect(client.confirmContact).not.toHaveBeenCalled();
      expect(service.error()).toBeTruthy();
    });

    it('resends the code via the pending ticket', async () => {
      setPending();
      client.resendContactCode.mockResolvedValue({});

      const ok = await service.resendContactCode();

      expect(ok).toBe(true);
      expect(client.resendContactCode).toHaveBeenCalledWith({ ticket: 'ticket-abc' });
    });
  });
});
