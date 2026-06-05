import { Code } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import {
  ConfirmContactRequestSchema,
  GetOAuthAuthorizeUrlRequestSchema,
  OAuthLoginRequestSchema,
  OauthProvider,
  ResendContactCodeRequestSchema,
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
  const vkClient = {
    createPkce: jest.fn(),
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
  const authRepository = { findByEmail: jest.fn(), findById: jest.fn(), toMessage: jest.fn() };
  const refreshTokenRepository = { save: jest.fn() };
  const tokenService = {
    generateTokenPair: jest.fn(),
    issueContactTicket: jest.fn(),
    verifyContactTicket: jest.fn(),
  };
  const auditService = { record: jest.fn() };
  const contactVerificationRepository = {
    upsertCode: jest.fn(),
    findByUserId: jest.fn(),
    incrementAttempts: jest.fn(),
    markConfirmed: jest.fn(),
    matches: jest.fn(),
  };
  const codeMailer = { sendCode: jest.fn() };
  const notificationService = { createInternalNotification: jest.fn() };

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

  function verificationRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: 'cv-1',
      userId: 'user-1',
      codeHash: 'hash',
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      lastSentAt: new Date(Date.now() - 120_000),
      confirmedAt: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    service = new OAuthService(
      googleClient as never,
      yandexClient as never,
      vkClient as never,
      stateService as never,
      oauthAccountRepository as never,
      authRepository as never,
      refreshTokenRepository as never,
      tokenService as never,
      auditService as never,
      contactVerificationRepository as never,
      codeMailer as never,
      notificationService as never,
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
    tokenService.issueContactTicket.mockReturnValue('contact-ticket-xyz');
    refreshTokenRepository.save.mockResolvedValue(undefined);
    contactVerificationRepository.findByUserId.mockResolvedValue(null);
    contactVerificationRepository.upsertCode.mockResolvedValue(undefined);
    codeMailer.sendCode.mockResolvedValue(undefined);
    notificationService.createInternalNotification.mockResolvedValue(undefined);
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

      expect(stateService.issue).toHaveBeenCalledWith(undefined);
      expect(googleClient.buildAuthorizeUrl).toHaveBeenCalledWith('signed-state-abc', undefined);
      expect(res.url).toBe('https://accounts.google.com/o/oauth2/v2/auth?x=1');
      expect(res.state).toBe('signed-state-abc');
    });

    it('embeds the VK PKCE verifier in the state and passes the challenge to the URL', async () => {
      vkClient.createPkce.mockReturnValue({ verifier: 'pkce-verifier', challenge: 'pkce-challenge' });
      stateService.issue.mockReturnValue('signed-state-vk');
      vkClient.buildAuthorizeUrl.mockReturnValue('https://id.vk.ru/authorize?x=1');

      const res = await service.getAuthorizeUrl(
        create(GetOAuthAuthorizeUrlRequestSchema, { provider: OauthProvider.VK }),
      );

      expect(stateService.issue).toHaveBeenCalledWith('pkce-verifier');
      expect(vkClient.buildAuthorizeUrl).toHaveBeenCalledWith('signed-state-vk', 'pkce-challenge');
      expect(res.url).toBe('https://id.vk.ru/authorize?x=1');
    });

    it('rejects an unsupported provider with Unimplemented', async () => {
      await expect(
        service.getAuthorizeUrl(
          create(GetOAuthAuthorizeUrlRequestSchema, { provider: OauthProvider.UNSPECIFIED }),
        ),
      ).rejects.toMatchObject({ code: Code.Unimplemented });
    });
  });

  describe('login — verification gating', () => {
    beforeEach(() => {
      stateService.verify.mockReturnValue(undefined);
      googleClient.exchangeCode.mockResolvedValue({ accessToken: 'g-access', idToken: 'g-id' });
      googleClient.getUserInfo.mockResolvedValue(profile);
    });

    it('logs in an already-linked & confirmed account without a code', async () => {
      oauthAccountRepository.findUserByProviderAccount.mockResolvedValue(userRecord());
      contactVerificationRepository.findByUserId.mockResolvedValue(null); // нет ожидающего подтверждения

      const res = await service.login(loginRequest());

      expect(oauthAccountRepository.linkAccount).not.toHaveBeenCalled();
      expect(codeMailer.sendCode).not.toHaveBeenCalled();
      expect(res.result?.accessToken).toBe('our-access-token');
      expect(res.verificationRequired).toBe(false);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'user.oauth_login_succeeded', targetId: 'user-1' }),
      );
    });

    it('re-requires a code on repeat login if the user abandoned verification', async () => {
      oauthAccountRepository.findUserByProviderAccount.mockResolvedValue(userRecord());
      contactVerificationRepository.findByUserId.mockResolvedValue(verificationRecord());

      const res = await service.login(loginRequest());

      expect(res.verificationRequired).toBe(true);
      expect(res.result).toBeUndefined();
      expect(codeMailer.sendCode).toHaveBeenCalled();
      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    });

    it('first link of a verified email requires a contact code (no tokens yet)', async () => {
      oauthAccountRepository.findUserByProviderAccount.mockResolvedValue(null);
      authRepository.findByEmail.mockResolvedValue(userRecord({ id: 'user-existing' }));

      const res = await service.login(loginRequest());

      expect(oauthAccountRepository.linkAccount).toHaveBeenCalledWith(
        'user-existing',
        'Google',
        'google-sub-1',
      );
      expect(res.verificationRequired).toBe(true);
      expect(res.verificationTicket).toBe('contact-ticket-xyz');
      expect(res.contactToVerify).toBe('user@example.com');
      expect(res.result).toBeUndefined();
      expect(contactVerificationRepository.upsertCode).toHaveBeenCalled();
      expect(codeMailer.sendCode).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'user.contact_verification_sent' }),
      );
    });

    it('new OAuth registration requires a contact code (account created, no tokens)', async () => {
      oauthAccountRepository.findUserByProviderAccount.mockResolvedValue(null);
      authRepository.findByEmail.mockResolvedValue(null);
      oauthAccountRepository.createUserWithAccount.mockResolvedValue(userRecord({ id: 'user-new' }));

      const res = await service.login(loginRequest());

      expect(oauthAccountRepository.createUserWithAccount).toHaveBeenCalledWith(
        { email: 'user@example.com', fullName: 'Test User', role: PrismaRole.Applicant },
        'Google',
        'google-sub-1',
      );
      expect(res.verificationRequired).toBe(true);
      expect(res.result).toBeUndefined();
      expect(codeMailer.sendCode).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'user.oauth_registered', targetId: 'user-new' }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'user.contact_verification_sent' }),
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

    it('rejects when the provider returns no email and does not create a user', async () => {
      stateService.verify.mockReturnValue('');
      yandexClient.exchangeCode.mockResolvedValue({ accessToken: 'ya-access' });
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

  describe('login — VK', () => {
    it('forwards the PKCE verifier (from state) and device_id; then requires a code', async () => {
      stateService.verify.mockReturnValue('pkce-verifier');
      vkClient.exchangeCode.mockResolvedValue({ accessToken: 'vk-access' });
      vkClient.getUserInfo.mockResolvedValue({
        providerUserId: 'vk-id-1',
        email: 'vk-user@vk.com',
        emailVerified: true,
        fullName: 'ВК Пользователь',
      });
      oauthAccountRepository.findUserByProviderAccount.mockResolvedValue(null);
      authRepository.findByEmail.mockResolvedValue(null);
      oauthAccountRepository.createUserWithAccount.mockResolvedValue(
        userRecord({ id: 'user-vk', email: 'vk-user@vk.com' }),
      );

      const res = await service.login(
        loginRequest({ provider: OauthProvider.VK, code: 'vk-code', deviceId: 'device-xyz' }),
      );

      expect(vkClient.exchangeCode).toHaveBeenCalledWith({
        code: 'vk-code',
        codeVerifier: 'pkce-verifier',
        deviceId: 'device-xyz',
      });
      expect(oauthAccountRepository.createUserWithAccount).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'vk-user@vk.com' }),
        'Vk',
        'vk-id-1',
      );
      expect(res.verificationRequired).toBe(true);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ after: expect.objectContaining({ provider: 'vk' }) }),
      );
    });
  });

  describe('confirmContact', () => {
    function confirmRequest(code = '123456', ticket = 'ticket') {
      return create(ConfirmContactRequestSchema, { ticket, code });
    }

    beforeEach(() => {
      tokenService.verifyContactTicket.mockReturnValue({ sub: 'user-1', email: 'user@example.com' });
      authRepository.findById.mockResolvedValue(userRecord());
    });

    it('confirms a valid code, completes login and notifies the user', async () => {
      contactVerificationRepository.findByUserId.mockResolvedValue(verificationRecord());
      contactVerificationRepository.matches.mockReturnValue(true);

      const res = await service.confirmContact(confirmRequest());

      expect(contactVerificationRepository.markConfirmed).toHaveBeenCalledWith('user-1');
      expect(notificationService.createInternalNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
      );
      expect(res.result?.accessToken).toBe('our-access-token');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'user.contact_confirmed', targetId: 'user-1' }),
      );
    });

    it('rejects a wrong code, increments attempts and audits the failure', async () => {
      contactVerificationRepository.findByUserId.mockResolvedValue(verificationRecord());
      contactVerificationRepository.matches.mockReturnValue(false);

      await expect(service.confirmContact(confirmRequest('000000'))).rejects.toMatchObject({
        code: Code.InvalidArgument,
      });
      expect(contactVerificationRepository.incrementAttempts).toHaveBeenCalledWith('user-1');
      expect(contactVerificationRepository.markConfirmed).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.contact_confirmation_failed',
          after: expect.objectContaining({ reason: 'invalid_code' }),
        }),
      );
    });

    it('rejects an expired code', async () => {
      contactVerificationRepository.findByUserId.mockResolvedValue(
        verificationRecord({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.confirmContact(confirmRequest())).rejects.toMatchObject({
        code: Code.DeadlineExceeded,
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ after: expect.objectContaining({ reason: 'expired' }) }),
      );
    });

    it('rejects once attempts are exhausted', async () => {
      contactVerificationRepository.findByUserId.mockResolvedValue(verificationRecord({ attempts: 5 }));

      await expect(service.confirmContact(confirmRequest())).rejects.toMatchObject({
        code: Code.ResourceExhausted,
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ after: expect.objectContaining({ reason: 'attempts_exceeded' }) }),
      );
    });

    it('rejects an invalid ticket anonymously', async () => {
      tokenService.verifyContactTicket.mockImplementation(() => {
        throw new Error('bad ticket');
      });

      await expect(service.confirmContact(confirmRequest())).rejects.toMatchObject({
        code: Code.Unauthenticated,
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'user.contact_confirmation_failed',
          allowAnonymous: true,
          targetType: 'Security',
          after: expect.objectContaining({ reason: 'invalid_ticket' }),
        }),
      );
    });
  });

  describe('resendContactCode', () => {
    function resendRequest(ticket = 'ticket') {
      return create(ResendContactCodeRequestSchema, { ticket });
    }

    beforeEach(() => {
      tokenService.verifyContactTicket.mockReturnValue({ sub: 'user-1', email: 'user@example.com' });
      authRepository.findById.mockResolvedValue(userRecord());
    });

    it('issues a fresh code once the cooldown has passed', async () => {
      contactVerificationRepository.findByUserId.mockResolvedValue(
        verificationRecord({ lastSentAt: new Date(Date.now() - 120_000) }),
      );

      await service.resendContactCode(resendRequest());

      expect(contactVerificationRepository.upsertCode).toHaveBeenCalled();
      expect(codeMailer.sendCode).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'user.contact_verification_sent' }),
      );
    });

    it('rejects resends inside the cooldown window (anti brute-force)', async () => {
      contactVerificationRepository.findByUserId.mockResolvedValue(
        verificationRecord({ lastSentAt: new Date(Date.now() - 5_000) }),
      );

      await expect(service.resendContactCode(resendRequest())).rejects.toMatchObject({
        code: Code.ResourceExhausted,
      });
      expect(contactVerificationRepository.upsertCode).not.toHaveBeenCalled();
      expect(codeMailer.sendCode).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ after: expect.objectContaining({ reason: 'resend_too_soon' }) }),
      );
    });
  });

  it('never writes the auth code, provider tokens or the verification code into the audit trail', async () => {
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

    // Код подтверждения, отправленный мейлеру, не должен попасть в аудит.
    const sentCode = codeMailer.sendCode.mock.calls[0]?.[1] as string;
    expect(sentCode).toMatch(/^\d{6}$/);

    const auditPayload = JSON.stringify(auditService.record.mock.calls);
    expect(auditPayload).not.toContain('AUTH-CODE-SECRET');
    expect(auditPayload).not.toContain('ACCESS-TOKEN-SECRET');
    expect(auditPayload).not.toContain('ID-TOKEN-SECRET');
    expect(auditPayload).not.toContain(sentCode);
  });
});
