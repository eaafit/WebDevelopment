import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RPC_TRANSPORT, TokenStore, WebLoggerService } from '@notary-portal/ui';
import { AuthService, OAUTH_PROVIDERS } from './auth.service';
import { OAuthApiService } from './oauth-api.service';

function makeJwt(payload: object): string {
  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64url({ alg: 'HS256' })}.${b64url(payload)}.sig`;
}

const NOW = Math.floor(Date.now() / 1000);
const TOKEN = makeJwt({ sub: 'u1', email: 'a@b.com', role: '1', iat: NOW, exp: NOW + 900 });

describe('AuthService — OAuth (Google / Яндекс)', () => {
  const oauthApi = {
    getAuthorizeUrl: jest.fn(),
    oAuthLogin: jest.fn(),
    confirmContact: jest.fn(),
    resendContactCode: jest.fn(),
    readAppleStubProfile: jest.fn(),
    readStubProfile: jest.fn(),
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
        { provide: OAuthApiService, useValue: oauthApi },
      ],
    });
    service = TestBed.inject(AuthService);
    TestBed.inject(TokenStore).clear();
  });

  describe('getAuthorizeUrl', () => {
    it('uses a dev stub URL for Google without calling the real backend', async () => {
      const url = await service.getAuthorizeUrl(OAUTH_PROVIDERS['google']);

      expect(url).toContain('https://dev.stub.local/oauth/google?state=');
      expect(sessionStorage.getItem('oauth_state')).toContain('stub-google-');
      expect(oauthApi.getAuthorizeUrl).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('oauth.google.authorize_requested', {
        provider: 'google',
      });
    });

    it('uses a dev stub URL for Yandex without calling the real backend', async () => {
      const url = await service.getAuthorizeUrl(OAUTH_PROVIDERS['yandex']);

      expect(url).toContain('https://dev.stub.local/oauth/yandex?state=');
      expect(sessionStorage.getItem('oauth_state')).toContain('stub-yandex-');
      expect(oauthApi.getAuthorizeUrl).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('oauth.yandex.authorize_requested', {
        provider: 'yandex',
      });
    });
  });

  describe('completeOAuthLogin', () => {
    it('opens the contact-verification flow for a stub provider', async () => {
      oauthApi.readStubProfile.mockResolvedValue({
        provider: 'google',
        sub: 'google-demo',
        email: 'demo@gmail.local',
        name: 'Google Demo User',
      });

      const ok = await service.completeOAuthLogin(
        OAUTH_PROVIDERS['google'],
        'auth-code',
        'ignored',
      );

      expect(ok).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/auth/verify-contact');
      expect(service.getPendingVerification()).toEqual({
        ticket: 'stub:google',
        contact: 'demo@gmail.local',
        providerKey: 'google',
      });
    });

    it('opens the contact-verification flow for a stub VK provider', async () => {
      oauthApi.readStubProfile.mockResolvedValue({
        provider: 'vk',
        sub: 'vk-demo',
        email: 'demo@vk.local',
        name: 'VK Demo User',
      });

      const ok = await service.completeOAuthLogin(
        OAUTH_PROVIDERS['vk'],
        'vk-code',
        'ignored',
        'device-77',
      );

      expect(ok).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/auth/verify-contact');
      expect(service.getPendingVerification()).toEqual({
        ticket: 'stub:vk',
        contact: 'demo@vk.local',
        providerKey: 'vk',
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
      oauthApi.confirmContact.mockResolvedValue({
        accessToken: TOKEN,
        refreshToken: 'rt',
        user: {
          id: 'u1',
          email: 'new@user.com',
          fullName: 'N',
          role: 1,
          phoneNumber: '',
          isActive: true,
        },
      });

      const ok = await service.confirmContact('123456');

      expect(ok).toBe(true);
      expect(oauthApi.confirmContact).toHaveBeenCalledWith('ticket-abc', '123456');
      expect(service.isLoggedIn()).toBe(true);
      expect(service.getPendingVerification()).toBeNull();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/applicant');
    });

    it('reports an error and stays out when there is no pending verification', async () => {
      const ok = await service.confirmContact('123456');

      expect(ok).toBe(false);
      expect(oauthApi.confirmContact).not.toHaveBeenCalled();
      expect(service.error()).toBeTruthy();
    });

    it('resends the code via the pending ticket', async () => {
      setPending();
      oauthApi.resendContactCode.mockResolvedValue(undefined);

      const ok = await service.resendContactCode();

      expect(ok).toBe(true);
      expect(oauthApi.resendContactCode).toHaveBeenCalledWith('ticket-abc');
    });
  });

  describe('Apple stub', () => {
    it('reads the local stub profile and opens contact verification', async () => {
      oauthApi.readStubProfile.mockResolvedValue({
        provider: 'apple',
        sub: 'apple.localhost.stub',
        email: 'apple.stub@localhost',
        name: 'Apple Stub',
      });

      await service.startStubOAuth(OAUTH_PROVIDERS['apple']);

      expect(oauthApi.readStubProfile).toHaveBeenCalledWith('apple', 'Apple');
      expect(service.getPendingVerification()).toEqual({
        ticket: 'stub:apple',
        contact: 'apple.stub@localhost',
        providerKey: 'apple',
      });
      expect(router.navigateByUrl).toHaveBeenCalledWith('/auth/verify-contact');
    });

    it('accepts any 6-digit code without calling RPC', async () => {
      sessionStorage.setItem('oauth_verify_ticket', 'stub:apple');
      sessionStorage.setItem('oauth_verify_contact', 'apple.stub@localhost');
      sessionStorage.setItem('oauth_verify_provider', 'apple');

      const ok = await service.confirmContact('654321');

      expect(ok).toBe(true);
      expect(oauthApi.confirmContact).not.toHaveBeenCalled();
      expect(service.isLoggedIn()).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/applicant');
    });
  });
});
