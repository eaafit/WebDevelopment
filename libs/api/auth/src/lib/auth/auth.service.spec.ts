import { Code } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { Logger } from '@nestjs/common';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Role as PrismaRole } from '@internal/prisma-client';
import {
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  NotificationType,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  UserRole,
  UserSchema,
  type User,
} from '@notary-portal/api-contracts';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const authRepository = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn(),
    updatePasswordHash: jest.fn(),
    toPrismaRole: jest.fn(),
    toMessage: jest.fn(),
  };
  const refreshTokenRepository = {
    save: jest.fn(),
    rotate: jest.fn(),
    revoke: jest.fn(),
    revokeAll: jest.fn(),
  };
  const passwordResetRepository = {
    create: jest.fn(),
    findValid: jest.fn(),
    markUsed: jest.fn(),
  };
  const passwordService = {
    hash: jest.fn(),
    compare: jest.fn(),
  };
  const tokenService = {
    generateTokenPair: jest.fn(),
    verifyAccessToken: jest.fn(),
    generatePasswordResetToken: jest.fn(),
  };
  const metrics = {
    recordUserRegistered: jest.fn(),
    recordAuthLogin: jest.fn(),
    recordAuthRegistration: jest.fn(),
    recordAuthPasswordReset: jest.fn(),
  };
  const auditService = {
    record: jest.fn(),
  };
  const notificationService = {
    createInternalNotificationsForRole: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AuthService(
      authRepository as never,
      refreshTokenRepository as never,
      passwordResetRepository as never,
      passwordService as never,
      tokenService as never,
      metrics as never,
      auditService as never,
      notificationService as never,
      null,
      null,
    );
  });

  it('logs in with a valid password hash', async () => {
    const record = {
      id: 'user-1',
      email: 'seed-user-000@seed.local',
      passwordHash: '$2a$12$abcdefghijklmnopqrstuuK1P6aQ4T6bVJj8M3R1xY8VfQ9g2zT4W',
      fullName: 'Заявитель 1',
      role: 'Applicant',
      phoneNumber: '+7999000000',
      isActive: true,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    };
    const user: User = create(UserSchema, {
      id: 'user-1',
      email: 'seed-user-000@seed.local',
      fullName: 'Заявитель 1',
      role: UserRole.APPLICANT,
      phoneNumber: '+7999000000',
      isActive: true,
    });

    authRepository.findByEmail.mockResolvedValue(record);
    authRepository.toMessage.mockReturnValue(user);
    passwordService.compare.mockResolvedValue(true);
    tokenService.generateTokenPair.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshExpiresAt: new Date('2026-04-12T00:00:00.000Z'),
    });
    refreshTokenRepository.save.mockResolvedValue(undefined);

    const result = await service.login(
      create(LoginRequestSchema, {
        email: ' Seed-User-000@Seed.Local ',
        password: 'SeedPass123!',
      }),
    );

    expect(authRepository.findByEmail).toHaveBeenCalledWith('seed-user-000@seed.local');
    expect(passwordService.compare).toHaveBeenCalledWith('SeedPass123!', record.passwordHash);
    expect(refreshTokenRepository.save).toHaveBeenCalledWith(
      'user-1',
      'refresh-token',
      new Date('2026-04-12T00:00:00.000Z'),
    );
    expect(result.result?.accessToken).toBe('access-token');
    expect(result.result?.refreshToken).toBe('refresh-token');
    expect(result.result?.user?.email).toBe('seed-user-000@seed.local');
    expect(metrics.recordAuthLogin).toHaveBeenCalledWith('success');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user-1',
        actorEmail: 'seed-user-000@seed.local',
        actorName: 'Заявитель 1',
        actorRole: 'Applicant',
        eventType: 'user.login_succeeded',
        targetType: 'User',
        targetId: 'user-1',
        after: expect.objectContaining({
          outcome: 'succeeded',
          email: 'seed-user-000@seed.local',
          role: 'Applicant',
        }),
      }),
    );
  });

  it('registers with a normalized email address', async () => {
    const user: User = create(UserSchema, {
      id: 'user-2',
      email: 'new-user@example.com',
      fullName: 'New User',
      role: UserRole.APPLICANT,
      phoneNumber: '+7999000001',
      isActive: true,
    });

    authRepository.findByEmail.mockResolvedValue(null);
    authRepository.toPrismaRole.mockReturnValue('Applicant');
    authRepository.createUser.mockResolvedValue(user);
    passwordService.hash.mockResolvedValue('password-hash');
    tokenService.generateTokenPair.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshExpiresAt: new Date('2026-04-12T00:00:00.000Z'),
    });
    refreshTokenRepository.save.mockResolvedValue(undefined);

    await service.register(
      create(RegisterRequestSchema, {
        email: ' New-User@Example.Com ',
        password: 'Password123',
        fullName: ' New User ',
        phoneNumber: ' +7999000001 ',
        role: UserRole.APPLICANT,
      }),
    );

    expect(authRepository.findByEmail).toHaveBeenCalledWith('new-user@example.com');
    expect(authRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new-user@example.com',
        passwordHash: 'password-hash',
        fullName: 'New User',
        phoneNumber: '+7999000001',
      }),
    );
    expect(metrics.recordUserRegistered).toHaveBeenCalledTimes(1);
    expect(authRepository.createUser.mock.invocationCallOrder[0]).toBeLessThan(
      metrics.recordUserRegistered.mock.invocationCallOrder[0],
    );
    expect(metrics.recordAuthRegistration).toHaveBeenCalledWith('success', 'applicant');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user-2',
        actorEmail: 'new-user@example.com',
        actorName: 'New User',
        actorRole: 'Applicant',
        eventType: 'user.registered',
        targetType: 'User',
        targetId: 'user-2',
        after: expect.objectContaining({
          outcome: 'succeeded',
          email: 'new-user@example.com',
          role: 'Applicant',
        }),
      }),
    );
    expect(notificationService.createInternalNotificationsForRole).toHaveBeenCalledWith(
      PrismaRole.Admin,
      expect.objectContaining({
        title: 'Новый пользователь зарегистрировался',
        message: expect.stringContaining('New User создал аккаунт (Заявитель)'),
        type: NotificationType.IN_APP,
      }),
    );
    expect(
      notificationService.createInternalNotificationsForRole.mock.calls[0][1],
    ).not.toHaveProperty('category');
  });

  it('keeps registration successful when admin notification creation fails', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const user: User = create(UserSchema, {
      id: 'user-3',
      email: 'new-notary@example.com',
      fullName: '',
      role: UserRole.NOTARY,
      isActive: true,
    });

    authRepository.findByEmail.mockResolvedValue(null);
    authRepository.toPrismaRole.mockReturnValue('Notary');
    authRepository.createUser.mockResolvedValue(user);
    passwordService.hash.mockResolvedValue('password-hash');
    tokenService.generateTokenPair.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshExpiresAt: new Date('2026-04-12T00:00:00.000Z'),
    });
    refreshTokenRepository.save.mockResolvedValue(undefined);
    notificationService.createInternalNotificationsForRole.mockRejectedValue(
      new Error('notification failed'),
    );

    const result = await service.register(
      create(RegisterRequestSchema, {
        email: 'new-notary@example.com',
        password: 'Password123',
        fullName: 'New Notary',
        role: UserRole.NOTARY,
      }),
    );

    expect(result.result?.accessToken).toBe('access-token');
    expect(result.result?.refreshToken).toBe('refresh-token');
    expect(notificationService.createInternalNotificationsForRole).toHaveBeenCalledWith(
      PrismaRole.Admin,
      expect.objectContaining({
        message: expect.stringContaining('new-notary@example.com создал аккаунт (Нотариус)'),
      }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Auth notification failed; operation=auth.registration.notify_admins; result=error; error=Error',
    );

    warnSpy.mockRestore();
  });

  it('keeps registration successful but marks welcome mail span as failed', async () => {
    const tracing = mockTracer();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const transactionalMailer = {
      sendWelcomeAfterRegistration: jest.fn().mockRejectedValue(new Error('smtp failed')),
    };
    const user: User = create(UserSchema, {
      id: 'user-4',
      email: 'mail-user@example.com',
      fullName: 'Mail User',
      role: UserRole.APPLICANT,
      isActive: true,
    });
    const serviceWithMailer = new AuthService(
      authRepository as never,
      refreshTokenRepository as never,
      passwordResetRepository as never,
      passwordService as never,
      tokenService as never,
      metrics as never,
      auditService as never,
      notificationService as never,
      null,
      transactionalMailer as never,
    );

    authRepository.findByEmail.mockResolvedValue(null);
    authRepository.toPrismaRole.mockReturnValue('Applicant');
    authRepository.createUser.mockResolvedValue(user);
    passwordService.hash.mockResolvedValue('password-hash');
    tokenService.generateTokenPair.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshExpiresAt: new Date('2026-04-12T00:00:00.000Z'),
    });
    refreshTokenRepository.save.mockResolvedValue(undefined);

    const result = await serviceWithMailer.register(
      create(RegisterRequestSchema, {
        email: 'mail-user@example.com',
        password: 'Password123',
        fullName: 'Mail User',
        role: UserRole.APPLICANT,
      }),
    );
    await settleBestEffortWork();

    expect(result.result?.accessToken).toBe('access-token');
    expect(transactionalMailer.sendWelcomeAfterRegistration).toHaveBeenCalled();
    const mailSpan = tracing.spans.get('TransactionalMailer.sendWelcomeAfterRegistration');
    expect(mailSpan?.setAttribute).toHaveBeenCalledWith('auth.mail.delivery', 'failed');
    expect(mailSpan?.setAttribute).toHaveBeenCalledWith('notary.side_effect.result', 'error');
    expect(mailSpan?.setAttribute).toHaveBeenCalledWith('notary.result', 'error');
    expect(mailSpan?.setAttribute).not.toHaveBeenCalledWith('notary.result', 'success');
    expect(mailSpan?.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: 'Error',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Auth mail delivery failed; operation=auth.mail.send_welcome; result=error; error=Error',
    );
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('smtp failed');
    expect(mailSpanAttributes(tracing, 'TransactionalMailer.sendWelcomeAfterRegistration')).toEqual(
      {
        'notary.operation': 'auth.mail.send_welcome',
        'notary.entity': 'User',
      },
    );
    expect(mailSpanAttributes(tracing, 'AuthService.register')).not.toHaveProperty(
      'notary.actor.role',
    );

    tracing.restore();
    warnSpy.mockRestore();
  });

  it('rejects invalid credentials when password comparison fails', async () => {
    authRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'seed-user-000@seed.local',
      fullName: 'Заявитель 1',
      role: 'Applicant',
      passwordHash: '$2a$12$abcdefghijklmnopqrstuuK1P6aQ4T6bVJj8M3R1xY8VfQ9g2zT4W',
      isActive: true,
    });
    passwordService.compare.mockResolvedValue(false);

    await expect(
      service.login(
        create(LoginRequestSchema, {
          email: 'seed-user-000@seed.local',
          password: 'wrong-password',
        }),
      ),
    ).rejects.toMatchObject({
      code: Code.Unauthenticated,
      message: '[unauthenticated] invalid credentials',
    });

    expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    expect(metrics.recordAuthLogin).toHaveBeenCalledWith('failed', 'invalid_password');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorEmail: 'seed-user-000@seed.local',
        actorName: 'Заявитель 1',
        actorRole: 'Applicant',
        allowAnonymous: true,
        eventType: 'user.login_failed',
        targetType: 'User',
        targetId: 'user-1',
        actionTitle: 'Неудачная попытка входа',
        actionContext: 'Неверный пароль',
        targetTitle: 'Заявитель 1',
        targetContext: 'seed-user-000@seed.local',
        after: expect.objectContaining({
          reason: 'invalid_password',
          email: 'seed-user-000@seed.local',
          role: 'Applicant',
        }),
      }),
    );
  });

  it('records a registration failure without storing the password', async () => {
    authRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'new-user@example.com',
      fullName: 'Existing User',
      role: 'Applicant',
      isActive: true,
    });

    await expect(
      service.register(
        create(RegisterRequestSchema, {
          email: ' New-User@Example.Com ',
          password: 'Password123',
          fullName: 'New User',
          role: UserRole.APPLICANT,
        }),
      ),
    ).rejects.toMatchObject({
      code: Code.AlreadyExists,
      message: '[already_exists] email already registered',
    });

    expect(authRepository.createUser).not.toHaveBeenCalled();
    expect(metrics.recordUserRegistered).not.toHaveBeenCalled();
    expect(metrics.recordAuthRegistration).toHaveBeenCalledWith(
      'failed',
      'applicant',
      'email_already_registered',
    );
    expect(notificationService.createInternalNotificationsForRole).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorEmail: 'new-user@example.com',
        actorName: 'Existing User',
        actorRole: 'Applicant',
        allowAnonymous: true,
        eventType: 'user.registration_failed',
        targetType: 'User',
        targetId: 'user-1',
        after: expect.objectContaining({
          outcome: 'failed',
          reason: 'email_already_registered',
          email: 'new-user@example.com',
          role: 'Applicant',
        }),
      }),
    );
    expect(JSON.stringify(auditService.record.mock.calls)).not.toContain('Password123');
  });

  it('records an anonymous login failure when the email is unknown', async () => {
    authRepository.findByEmail.mockResolvedValue(null);

    await expect(
      service.login(
        create(LoginRequestSchema, {
          email: 'ghost@example.com',
          password: 'wrong-password',
        }),
      ),
    ).rejects.toMatchObject({
      code: Code.Unauthenticated,
      message: '[unauthenticated] invalid credentials',
    });

    expect(metrics.recordAuthLogin).toHaveBeenCalledWith('failed', 'user_not_found');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorEmail: 'ghost@example.com',
        allowAnonymous: true,
        eventType: 'user.login_failed',
        targetType: 'Security',
        targetId: null,
        after: expect.objectContaining({
          outcome: 'failed',
          reason: 'user_not_found',
          email: 'ghost@example.com',
        }),
      }),
    );
    expect(JSON.stringify(auditService.record.mock.calls)).not.toContain('wrong-password');
  });

  it('records password reset requests without storing reset tokens or URLs', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    authRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'seed-user-000@seed.local',
      fullName: 'Заявитель 1',
      role: 'Applicant',
      isActive: true,
    });
    tokenService.generatePasswordResetToken.mockReturnValue('raw-reset-token');
    passwordResetRepository.create.mockResolvedValue(undefined);

    await service.forgotPassword(
      create(ForgotPasswordRequestSchema, {
        email: ' Seed-User-000@Seed.Local ',
      }),
    );

    expect(passwordResetRepository.create).toHaveBeenCalledWith(
      'user-1',
      'raw-reset-token',
      expect.any(Date),
    );
    expect(metrics.recordAuthPasswordReset).toHaveBeenCalledWith('request', 'success');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorEmail: 'seed-user-000@seed.local',
        actorName: 'Заявитель 1',
        actorRole: 'Applicant',
        allowAnonymous: true,
        eventType: 'user.password_reset_requested',
        targetType: 'User',
        targetId: 'user-1',
        after: expect.objectContaining({
          outcome: 'succeeded',
          email: 'seed-user-000@seed.local',
          role: 'Applicant',
        }),
      }),
    );
    const auditPayload = JSON.stringify(auditService.record.mock.calls);
    expect(auditPayload).not.toContain('raw-reset-token');
    expect(auditPayload).not.toContain('/auth/reset-password');
    expect(warnSpy).toHaveBeenCalledWith(
      '[Auth] PASSWORD_RESET_MAILER не настроен; ссылка сброса пароля не логируется',
    );
    const warnPayload = JSON.stringify(warnSpy.mock.calls);
    expect(warnPayload).not.toContain('raw-reset-token');
    expect(warnPayload).not.toContain('/auth/reset-password');
    warnSpy.mockRestore();
  });

  it('keeps forgotPassword successful but marks reset mail span as failed', async () => {
    const tracing = mockTracer();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const passwordResetMailer = {
      sendResetLink: jest.fn().mockRejectedValue(new Error('smtp failed')),
    };
    const serviceWithMailer = new AuthService(
      authRepository as never,
      refreshTokenRepository as never,
      passwordResetRepository as never,
      passwordService as never,
      tokenService as never,
      metrics as never,
      auditService as never,
      notificationService as never,
      passwordResetMailer as never,
      null,
    );

    authRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'seed-user-000@seed.local',
      fullName: 'Заявитель 1',
      role: 'Applicant',
      isActive: true,
    });
    tokenService.generatePasswordResetToken.mockReturnValue('raw-reset-token');
    passwordResetRepository.create.mockResolvedValue(undefined);

    await serviceWithMailer.forgotPassword(
      create(ForgotPasswordRequestSchema, {
        email: 'seed-user-000@seed.local',
      }),
    );
    await settleBestEffortWork();

    expect(passwordResetMailer.sendResetLink).toHaveBeenCalledWith(
      'seed-user-000@seed.local',
      expect.stringContaining('/auth/reset-password?token=raw-reset-token'),
    );
    const mailSpan = tracing.spans.get('PasswordResetMailer.sendResetLink');
    expect(mailSpan?.setAttribute).toHaveBeenCalledWith('auth.mail.delivery', 'failed');
    expect(mailSpan?.setAttribute).toHaveBeenCalledWith('notary.side_effect.result', 'error');
    expect(mailSpan?.setAttribute).toHaveBeenCalledWith('notary.result', 'error');
    expect(mailSpan?.setAttribute).not.toHaveBeenCalledWith('notary.result', 'success');
    expect(mailSpan?.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: 'Error',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Auth mail delivery failed; operation=auth.mail.send_password_reset; result=error; error=Error',
    );
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('smtp failed');
    expect(mailSpanAttributes(tracing, 'PasswordResetMailer.sendResetLink')).toEqual({
      'notary.operation': 'auth.mail.send_password_reset',
      'notary.entity': 'PasswordReset',
    });
    expect(
      JSON.stringify(mailSpanAttributes(tracing, 'PasswordResetMailer.sendResetLink')),
    ).not.toContain('raw-reset-token');

    tracing.restore();
    warnSpy.mockRestore();
  });

  it('records password reset failures for unknown emails', async () => {
    authRepository.findByEmail.mockResolvedValue(null);

    await service.forgotPassword(
      create(ForgotPasswordRequestSchema, {
        email: 'ghost@example.com',
      }),
    );

    expect(passwordResetRepository.create).not.toHaveBeenCalled();
    expect(metrics.recordAuthPasswordReset).toHaveBeenCalledWith(
      'request',
      'failed',
      'user_not_found_or_inactive',
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorEmail: 'ghost@example.com',
        allowAnonymous: true,
        eventType: 'user.password_reset_failed',
        targetType: 'Security',
        targetId: null,
        after: expect.objectContaining({
          outcome: 'failed',
          reason: 'user_not_found_or_inactive',
          email: 'ghost@example.com',
        }),
      }),
    );
  });

  it('records successful password reset completion without storing the new password or token', async () => {
    const record = {
      id: 'user-1',
      email: 'seed-user-000@seed.local',
      fullName: 'Заявитель 1',
      role: 'Applicant',
      passwordHash: 'old-password-hash',
      phoneNumber: '+7999000000',
      isActive: true,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    };
    passwordResetRepository.findValid.mockResolvedValue({
      id: 'reset-1',
      userId: 'user-1',
    });
    authRepository.findById.mockResolvedValue(record);
    passwordService.hash.mockResolvedValue('new-password-hash');
    authRepository.updatePasswordHash.mockResolvedValue(undefined);
    passwordResetRepository.markUsed.mockResolvedValue(undefined);
    refreshTokenRepository.revokeAll.mockResolvedValue(undefined);

    await service.resetPassword(
      create(ResetPasswordRequestSchema, {
        token: 'raw-reset-token',
        newPassword: 'NewPassword123',
      }),
    );

    expect(authRepository.updatePasswordHash).toHaveBeenCalledWith('user-1', 'new-password-hash');
    expect(passwordResetRepository.markUsed).toHaveBeenCalledWith('reset-1');
    expect(refreshTokenRepository.revokeAll).toHaveBeenCalledWith('user-1');
    expect(metrics.recordAuthPasswordReset).toHaveBeenCalledWith('submit', 'success');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user-1',
        actorEmail: 'seed-user-000@seed.local',
        actorName: 'Заявитель 1',
        actorRole: 'Applicant',
        eventType: 'user.password_reset_completed',
        targetType: 'User',
        targetId: 'user-1',
        after: expect.objectContaining({
          outcome: 'succeeded',
          email: 'seed-user-000@seed.local',
          role: 'Applicant',
        }),
      }),
    );
    const auditPayload = JSON.stringify(auditService.record.mock.calls);
    expect(auditPayload).not.toContain('raw-reset-token');
    expect(auditPayload).not.toContain('NewPassword123');
    expect(auditPayload).not.toContain('new-password-hash');
  });

  it('records password reset failures for invalid tokens without storing the token', async () => {
    passwordResetRepository.findValid.mockResolvedValue(null);

    await expect(
      service.resetPassword(
        create(ResetPasswordRequestSchema, {
          token: 'bad-reset-token',
          newPassword: 'NewPassword123',
        }),
      ),
    ).rejects.toMatchObject({
      code: Code.InvalidArgument,
      message: '[invalid_argument] invalid or expired reset token',
    });

    expect(authRepository.updatePasswordHash).not.toHaveBeenCalled();
    expect(metrics.recordAuthPasswordReset).toHaveBeenCalledWith(
      'submit',
      'failed',
      'invalid_or_expired_token',
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        allowAnonymous: true,
        eventType: 'user.password_reset_failed',
        targetType: 'Security',
        targetId: null,
        after: expect.objectContaining({
          outcome: 'failed',
          reason: 'invalid_or_expired_token',
        }),
      }),
    );
    expect(JSON.stringify(auditService.record.mock.calls)).not.toContain('bad-reset-token');
  });
});

type TracedSpanMock = {
  end: jest.Mock;
  recordException: jest.Mock;
  setAttribute: jest.Mock;
  setStatus: jest.Mock;
};

function mockTracer(): {
  spans: Map<string, TracedSpanMock>;
  startSpan: jest.Mock;
  restore: () => void;
} {
  const spans = new Map<string, TracedSpanMock>();
  const startSpan = jest.fn((spanName: string) => {
    const span = {
      end: jest.fn(),
      recordException: jest.fn(),
      setAttribute: jest.fn(),
      setStatus: jest.fn(),
    };
    spans.set(spanName, span);
    return span;
  });
  const getTracerSpy = jest.spyOn(trace, 'getTracer').mockReturnValue({ startSpan } as never);

  return {
    spans,
    startSpan,
    restore: () => getTracerSpy.mockRestore(),
  };
}

function mailSpanAttributes(
  tracing: { startSpan: jest.Mock },
  spanName: string,
): Record<string, unknown> | undefined {
  const call = tracing.startSpan.mock.calls.find(([name]) => name === spanName);
  return call?.[1]?.attributes;
}

async function settleBestEffortWork(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}
