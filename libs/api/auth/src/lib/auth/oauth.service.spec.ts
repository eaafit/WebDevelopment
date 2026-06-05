import { Code } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import {
  GetOAuthAuthorizeUrlRequestSchema,
  OAuthLoginRequestSchema,
  OauthProvider,
} from '@notary-portal/api-contracts';
import { Role as PrismaRole } from '@internal/prisma-client';
import { OAuthService } from './oauth.service';

describe('OAuthService', () => {
  const googleClient = {
    buildAuthorizeUrl: jest.fn(),
    exchangeCode: jest.fn(),
    getUserInfo: jest.fn(),
  };
  const yandexClient = {
    buildAuthorizeUrl: jest.fn(),
    exchangeCode: jest.fn(),
    getUserInfo: jest.fn(),
  };
  const stateService = { issue: jest.fn(), verify: jest.fn() };
  const oauthAccountRepository = {
    findUserByProviderAccount: jest.fn(),
    linkAccount: jest.fn(),
    createUserWithAccount: jest.fn(),
  };
  const authRepository = { findByEmail: jest.fn(), toMessage: jest.fn() };
  const refreshTokenRepository = { save: jest.fn() };
  const tokenService = { generateTokenPair: jest.fn() };
  const auditService = { record: jest.fn() };

  let service: OAuthService;

  const profile = {
    providerUserId: 'google-sub-1',
    email: 'user@example.com',
    emailVerified: true,
    fullName: 'Test User',
  };

  function userRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: 'user-1',
      email: 'user@example.com',
      fullName: 'Test User',
      role: PrismaRole.Applicant,
      phoneNumber: null,
      isActive: true,
      createdAt: new Date('2026-05-30T00:00:00.000Z'),
      updatedAt: new Date('2026-05-30T00:00:00.000Z'),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    service = new OAuthService(
      googleClient as never,
      yandexClient as never,
      stateService as never,
      oauthAccountRepository as never,
      authRepository as never,
      refreshTokenRepository as never,
      tokenService as never,
      auditService as never,
    );
    authRepository.toMessage.mockImplementation((r: { id: string; email: string }) => ({
      id: r.id,
      email: r.email,
      role: 1,
    }));
    tokenService.generateTokenPair.mockReturnValue({
      accessToken: 'our-access-token',
      refreshToken: 'our-refresh-token',
      refreshExpiresAt: new Date('2026-06-30T00:00:00.000Z'),
    });
    refreshTokenRepository.save.mockResolvedValue(undefined);
  });

  function loginRequest(overrides: Record<string, unknown> = {}) {
    return create(OAuthLoginRequestSchema, {
      provider: OauthProvider.GOOGLE,
      code: 'google-auth-code',
      state: 'signed-state',
      ...overrides,
    });
  }

  describe('getAuthorizeUrl', () => {
    it('returns the Google consent URL and the signed state', async () => {
      stateService.issue.mockReturnValue('signed-state-abc');
      googleClient.buildAuthorizeUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?x=1');

      const res = await service.getAuthorizeUrl(
        create(GetOAuthAuthorizeUrlRequestSchema, { provider: OauthProvider.GOOGLE }),
      );

      // Google не использует PKCE → issue без payload, buildAuthorizeUrl без challenge.
      expect(stateService.issue).toHaveBeenCalledWith(undefined);
      expect(googleClient.buildAuthorizeUrl).toHaveBeenCalledWith('signed-state-abc', undefined);
      expect(res.url).toBe('https://accounts.google.com/o/oauth2/v2/auth?x=1');
      expect(res.state).toBe('signed-state-abc');
    });

    it('returns the Yandex consent URL and the signed state', async () => {
      stateService.issue.mockReturnValue('signed-state-ya');
      yandexClient.buildAuthorizeUrl.mockReturnValue('https://oauth.yandex.ru/authorize?x=1');

      const res = await service.getAuthorizeUrl(
        create(GetOAuthAuthorizeUrlRequestSchema, { provider: OauthProvider.YANDEX }),
      );

      expect(yandexClient.buildAuthorizeUrl).toHaveBeenCalledWith('signed-state-ya', undefined);
      expect(res.url).toBe('https://oauth.yandex.ru/authorize?x=1');
      expect(res.state).toBe('signed-state-ya');
    });

    it('rejects an unsupported provider with Unimplemented', async () => {
      await expect(
        service.getAuthorizeUrl(
          create(GetOAuthAuthorizeUrlRequestSchema, { provider: OauthProvider.UNSPECIFIED }),
        ),
      ).rejects.toMatchObject({ code: Code.Unimplemented });
    });
  });

  describe('login — happy paths', () => {
    beforeEach(() => {
      stateService.verify.mockReturnValue(undefined);
      googleClient.exchangeCode.mockResolvedValue({ accessToken: 'g-access', idToken: 'g-id' });
      googleClient.getUserInfo.mockResolvedValue(profile);
    });

    it('logs in an already-linked account', async () => {
      oauthAccountRepository.findUserByProviderAccount.mockResolvedValue(userRecord());

      const res = await service.login(loginRequest());

      expect(oauthAccountRepository.linkAccount).not.toHaveBeenCalled();
      expect(oauthAccountRepository.createUserWithAccount).not.toHaveBeenCalled();
      expect(refreshTokenRepository.save).toHaveBeenCalledWith(
        'user-1',
        'our-refresh-token',
        new Date('2026-06-30T00:00:00.000Z'),
      );
      expect(res.result?.accessToken).toBe('our-access-token');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'user.oauth_login_succeeded', targetId: 'user-1' }),
      );
    });

    it('links a verified existing email account and logs in', async () => {
      oauthAccountRepository.findUserByProviderAccount.mockResolvedValue(null);
      authRepository.findByEmail.mockResolvedValue(userRecord({ id: 'user-existing' }));

      const res = await service.login(loginRequest());

      expect(oauthAccountRepository.linkAccount).toHaveBeenCalledWith(
        'user-existing',
        'Google',
        'google-sub-1',
      );
      expect(res.result?.refreshToken).toBe('our-refresh-token');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.oauth_login_succeeded',
          after: expect.objectContaining({ linked: true }),
        }),
      );
    });

    it('creates a new Applicant when no account exists', async () => {
      oauthAccountRepository.findUserByProviderAccount.mockResolvedValue(null);
      authRepository.findByEmail.mockResolvedValue(null);
      oauthAccountRepository.createUserWithAccount.mockResolvedValue(userRecord({ id: 'user-new' }));

      const res = await service.login(loginRequest());

      expect(oauthAccountRepository.createUserWithAccount).toHaveBeenCalledWith(
        { email: 'user@example.com', fullName: 'Test User', role: PrismaRole.Applicant },
        'Google',
        'google-sub-1',
      );
      expect(res.result?.user?.id).toBe('user-new');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'user.oauth_registered', targetId: 'user-new' }),
      );
    });
  });

  describe('login — failures', () => {
    it('rejects an invalid state before contacting Google', async () => {
      stateService.verify.mockImplementation(() => {
        throw new Error('bad state');
      });

      await expect(service.login(loginRequest())).rejects.toMatchObject({
        code: Code.Unauthenticated,
      });
      expect(googleClient.exchangeCode).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.oauth_login_failed',
          allowAnonymous: true,
          targetType: 'Security',
          after: expect.objectContaining({ reason: 'invalid_state' }),
        }),
      );
    });

    it('rejects when Google token exchange fails', async () => {
      stateService.verify.mockReturnValue(undefined);
      googleClient.exchangeCode.mockRejectedValue(new Error('google down'));

      await expect(service.login(loginRequest())).rejects.toMatchObject({
        code: Code.Unauthenticated,
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.oauth_login_failed',
          after: expect.objectContaining({ reason: 'provider_exchange_failed' }),
        }),
      );
    });

    it('refuses to link an unverified email and does not create a link', async () => {
      stateService.verify.mockReturnValue(undefined);
      googleClient.exchangeCode.mockResolvedValue({ accessToken: 'g-access', idToken: null });
      googleClient.getUserInfo.mockResolvedValue({ ...profile, emailVerified: false });
      oauthAccountRepository.findUserByProviderAccount.mockResolvedValue(null);
      authRepository.findByEmail.mockResolvedValue(userRecord());

      await expect(service.login(loginRequest())).rejects.toMatchObject({
        code: Code.PermissionDenied,
      });
      expect(oauthAccountRepository.linkAccount).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.oauth_login_failed',
          after: expect.objectContaining({ reason: 'email_not_verified' }),
        }),
      );
    });
  });

  describe('login — Yandex', () => {
    beforeEach(() => {
      stateService.verify.mockReturnValue('');
      yandexClient.exchangeCode.mockResolvedValue({ accessToken: 'ya-access' });
      yandexClient.getUserInfo.mockResolvedValue({
        providerUserId: 'yandex-id-1',
        email: 'ya-user@yandex.ru',
        emailVerified: true,
        fullName: 'Яндекс Пользователь',
      });
    });

    it('creates a new Applicant via Yandex and stores the Yandex provider', async () => {
      oauthAccountRepository.findUserByProviderAccount.mockResolvedValue(null);
      authRepository.findByEmail.mockResolvedValue(null);
      oauthAccountRepository.createUserWithAccount.mockResolvedValue(
        userRecord({ id: 'user-ya', email: 'ya-user@yandex.ru' }),
      );

      const res = await service.login(loginRequest({ provider: OauthProvider.YANDEX }));

      expect(yandexClient.exchangeCode).toHaveBeenCalled();
      expect(oauthAccountRepository.createUserWithAccount).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ya-user@yandex.ru', role: PrismaRole.Applicant }),
        'Yandex',
        'yandex-id-1',
      );
      expect(res.result?.user?.id).toBe('user-ya');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.oauth_registered',
          after: expect.objectContaining({ provider: 'yandex' }),
        }),
      );
    });

    it('rejects when the provider returns no email and does not create a user', async () => {
      yandexClient.getUserInfo.mockResolvedValue({
        providerUserId: 'yandex-id-2',
        email: '',
        emailVerified: false,
        fullName: 'No Email',
      });

      await expect(
        service.login(loginRequest({ provider: OauthProvider.YANDEX })),
      ).rejects.toMatchObject({ code: Code.Unauthenticated });
      expect(oauthAccountRepository.createUserWithAccount).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.oauth_login_failed',
          after: expect.objectContaining({ reason: 'no_email' }),
        }),
      );
    });
  });

  it('never writes Google code or tokens into the audit trail', async () => {
    stateService.verify.mockReturnValue(undefined);
    googleClient.exchangeCode.mockResolvedValue({
      accessToken: 'ACCESS-TOKEN-SECRET',
      idToken: 'ID-TOKEN-SECRET',
    });
    googleClient.getUserInfo.mockResolvedValue(profile);
    oauthAccountRepository.findUserByProviderAccount.mockResolvedValue(null);
    authRepository.findByEmail.mockResolvedValue(null);
    oauthAccountRepository.createUserWithAccount.mockResolvedValue(userRecord({ id: 'user-new' }));

    await service.login(loginRequest({ code: 'AUTH-CODE-SECRET' }));

    const auditPayload = JSON.stringify(auditService.record.mock.calls);
    expect(auditPayload).not.toContain('AUTH-CODE-SECRET');
    expect(auditPayload).not.toContain('ACCESS-TOKEN-SECRET');
    expect(auditPayload).not.toContain('ID-TOKEN-SECRET');
  });
});
