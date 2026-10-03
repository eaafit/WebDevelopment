import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AuditService } from '@internal/audit';
import { MetricsService } from '@internal/metrics';
import { NotificationService } from '@internal/notification';
import { Prisma, Role as PrismaRole } from '@internal/prisma-client';
import {
  BusinessOperations,
  NotarySpanAttributes,
  normalizeSpanActorRole,
  runInSpan,
  setSpanAttributes,
} from '@internal/tracing';
import {
  AuthResultSchema,
  ForgotPasswordResponseSchema,
  LoginResponseSchema,
  LogoutResponseSchema,
  NotificationType as RpcNotificationType,
  RegisterResponseSchema,
  RefreshTokenResponseSchema,
  ResetPasswordResponseSchema,
  UserRole as RpcUserRole,
  type ForgotPasswordRequest,
  type ForgotPasswordResponse,
  type LoginRequest,
  type LoginResponse,
  type LogoutRequest,
  type LogoutResponse,
  type RefreshTokenRequest,
  type RefreshTokenResponse,
  type RegisterRequest,
  type RegisterResponse,
  type ResetPasswordRequest,
  type ResetPasswordResponse,
} from '@notary-portal/api-contracts';
import { AuthRepository } from './auth.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { PasswordResetRepository } from './password-reset.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { PASSWORD_RESET_MAILER, type PasswordResetMailer } from './password-reset-mailer.interface';
import { TRANSACTIONAL_MAILER, type TransactionalMailer } from './transactional-mailer.interface';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;
const REGISTERED_EVENT = 'user.registered';
const REGISTRATION_FAILED_EVENT = 'user.registration_failed';
const LOGIN_SUCCEEDED_EVENT = 'user.login_succeeded';
const LOGIN_FAILED_EVENT = 'user.login_failed';
const PASSWORD_RESET_REQUESTED_EVENT = 'user.password_reset_requested';
const PASSWORD_RESET_FAILED_EVENT = 'user.password_reset_failed';
const PASSWORD_RESET_COMPLETED_EVENT = 'user.password_reset_completed';

type AuthAuditUser = {
  id: string;
  email: string;
  fullName?: string | null;
  role?: RpcUserRole | PrismaRole | string | number | null;
};

function roleLabelForRpc(role: RpcUserRole): string {
  switch (role) {
    case RpcUserRole.APPLICANT:
      return 'Заявитель';
    case RpcUserRole.NOTARY:
      return 'Нотариус';
    case RpcUserRole.ADMIN:
      return 'Администратор';
    default:
      return 'Пользователь';
  }
}

function toRpcRole(
  role: RpcUserRole | PrismaRole | string | number | null | undefined,
): RpcUserRole {
  switch (String(role ?? '')) {
    case '1':
    case 'USER_ROLE_APPLICANT':
    case PrismaRole.Applicant:
      return RpcUserRole.APPLICANT;
    case '2':
    case 'USER_ROLE_NOTARY':
    case PrismaRole.Notary:
      return RpcUserRole.NOTARY;
    case '3':
    case 'USER_ROLE_ADMIN':
    case PrismaRole.Admin:
      return RpcUserRole.ADMIN;
    default:
      return RpcUserRole.UNSPECIFIED;
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly metrics: MetricsService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    @Optional()
    @Inject(PASSWORD_RESET_MAILER)
    private readonly passwordResetMailer: PasswordResetMailer | null = null,
    @Optional()
    @Inject(TRANSACTIONAL_MAILER)
    private readonly transactionalMailer: TransactionalMailer | null = null,
  ) {}

  // ─── Register ────────────────────────────────────────────────────────────

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    return runInSpan(
      'AuthService.register',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.authRegister,
        [NotarySpanAttributes.entity]: 'User',
      },
      async () => {
        const email = (request.email ?? '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) {
          await this.recordRegistrationFailure(email, 'invalid_email', request.role);
          throw new ConnectError('email is invalid', Code.InvalidArgument);
        }
        if (request.password.length < MIN_PASSWORD_LEN) {
          await this.recordRegistrationFailure(email, 'weak_password', request.role);
          throw new ConnectError(
            `password must be at least ${MIN_PASSWORD_LEN} characters`,
            Code.InvalidArgument,
          );
        }
        if (!request.fullName?.trim()) {
          await this.recordRegistrationFailure(email, 'full_name_required', request.role);
          throw new ConnectError('full_name is required', Code.InvalidArgument);
        }
        if (request.role === RpcUserRole.ADMIN) {
          await this.recordRegistrationFailure(email, 'admin_role_denied', request.role);
          throw new ConnectError('cannot self-register as admin', Code.PermissionDenied);
        }

        const existing = await runInSpan(
          'AuthRepository.findByEmail register',
          {
            'notary.operation': 'auth.repository.lookup',
            'notary.entity': 'User',
            'db.operation': 'select',
          },
          () => this.authRepository.findByEmail(email),
        );
        if (existing) {
          await this.recordRegistrationFailure(
            email,
            'email_already_registered',
            request.role,
            existing,
          );
          throw new ConnectError('email already registered', Code.AlreadyExists);
        }

        const passwordHash = await runInSpan(
          'PasswordService.hash register',
          {
            'notary.operation': 'auth.password.hash',
            'notary.entity': 'User',
          },
          () => this.passwordService.hash(request.password),
        );
        const user = await runInSpan(
          'AuthRepository.createUser',
          {
            'notary.operation': 'auth.repository.create_user',
            'notary.entity': 'User',
            'db.operation': 'insert',
          },
          () =>
            this.authRepository.createUser({
              email,
              passwordHash,
              fullName: request.fullName.trim(),
              phoneNumber: request.phoneNumber?.trim() || undefined,
              role: this.authRepository.toPrismaRole(request.role),
            }),
        );

        const { accessToken, refreshToken, refreshExpiresAt } = await runInSpan(
          'TokenService.generateTokenPair register',
          {
            'notary.operation': 'auth.token_pair.generate',
            'notary.entity': 'AuthSession',
            'notary.actor.role': normalizeSpanActorRole(user.role),
          },
          () =>
            this.tokenService.generateTokenPair({
              sub: user.id,
              email: user.email,
              role: user.role.toString(),
            }),
        );

        await runInSpan(
          'RefreshTokenRepository.save register',
          {
            'notary.operation': 'auth.refresh_token.save',
            'notary.entity': 'AuthSession',
            'db.operation': 'insert',
          },
          () => this.refreshTokenRepository.save(user.id, refreshToken, refreshExpiresAt),
        );

        this.metrics.recordUserRegistered();
        this.metrics.recordAuthRegistration('success', metricRole(user.role));
        await this.recordRegistered(user);
        await this.notifyAdminsAboutRegistrationBestEffort(user);

        const transactionalMailer = this.transactionalMailer;
        if (transactionalMailer) {
          const base = (process.env['FRONTEND_URL'] ?? 'http://localhost:4200').replace(/\/$/, '');
          void runInSpan(
            'TransactionalMailer.sendWelcomeAfterRegistration',
            {
              'notary.operation': 'auth.mail.send_welcome',
              'notary.entity': 'User',
            },
            (mailSpan) =>
              transactionalMailer
                .sendWelcomeAfterRegistration({
                  email: user.email,
                  fullName: user.fullName,
                  roleLabel: roleLabelForRpc(user.role),
                  loginUrl: `${base}/auth`,
                })
                .catch((err: unknown) => {
                  setSpanAttributes(mailSpan, {
                    'auth.mail.delivery': 'failed',
                    'notary.side_effect.result': 'error',
                  });
                  throw err;
                }),
          ).catch((err: unknown) => {
            this.logger.warn(
              `Auth mail delivery failed; operation=auth.mail.send_welcome; result=error; error=${safeErrorName(err)}`,
            );
          });
        }

        return create(RegisterResponseSchema, {
          result: create(AuthResultSchema, { accessToken, refreshToken, user }),
        });
      },
    );
  }

  // ─── Login ───────────────────────────────────────────────────────────────

  async login(request: LoginRequest): Promise<LoginResponse> {
    return runInSpan(
      'AuthService.login',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.authLogin,
        [NotarySpanAttributes.entity]: 'AuthSession',
      },
      async () => {
        const email = (request.email ?? '').trim().toLowerCase();
        if (!email || !request.password) {
          await this.recordLoginFailure(email, 'missing_credentials');
          throw new ConnectError('email and password are required', Code.InvalidArgument);
        }

        const record = await runInSpan(
          'AuthRepository.findByEmail login',
          {
            'notary.operation': 'auth.repository.lookup',
            'notary.entity': 'User',
            'db.operation': 'select',
          },
          () => this.authRepository.findByEmail(email),
        );
        if (!record) {
          await this.recordLoginFailure(email, 'user_not_found');
          throw new ConnectError('invalid credentials', Code.Unauthenticated);
        }
        if (!record.isActive) {
          await this.recordLoginFailure(email, 'account_deactivated', record);
          throw new ConnectError('account is deactivated', Code.PermissionDenied);
        }

        // OAuth-only аккаунт (вход через внешний сервис) — пароля нет, парольный вход невозможен.
        if (!record.passwordHash) {
          await this.recordLoginFailure(email, 'oauth_only_account', record);
          throw new ConnectError('invalid credentials', Code.Unauthenticated);
        }

        const passwordHash = record.passwordHash;
        const passwordValid = await runInSpan(
          'PasswordService.compare login',
          {
            'notary.operation': 'auth.password.compare',
            'notary.entity': 'User',
            'notary.actor.role': normalizeSpanActorRole(record.role),
          },
          () => this.passwordService.compare(request.password, passwordHash),
        );
        if (!passwordValid) {
          await this.recordLoginFailure(email, 'invalid_password', record);
          throw new ConnectError('invalid credentials', Code.Unauthenticated);
        }

        const user = this.authRepository.toMessage(record);
        const { accessToken, refreshToken, refreshExpiresAt } = await runInSpan(
          'TokenService.generateTokenPair login',
          {
            'notary.operation': 'auth.token_pair.generate',
            'notary.entity': 'AuthSession',
            'notary.actor.role': normalizeSpanActorRole(user.role),
          },
          () =>
            this.tokenService.generateTokenPair({
              sub: user.id,
              email: user.email,
              role: user.role.toString(),
            }),
        );

        await runInSpan(
          'RefreshTokenRepository.save login',
          {
            'notary.operation': 'auth.refresh_token.save',
            'notary.entity': 'AuthSession',
            'db.operation': 'insert',
          },
          () => this.refreshTokenRepository.save(user.id, refreshToken, refreshExpiresAt),
        );
        await this.recordLoginSucceeded(record);

        return create(LoginResponseSchema, {
          result: create(AuthResultSchema, { accessToken, refreshToken, user }),
        });
      },
    );
  }

  // ─── RefreshToken ────────────────────────────────────────────────────────

  async refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    return runInSpan(
      'AuthService.refreshToken',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.authRefreshToken,
        [NotarySpanAttributes.entity]: 'AuthSession',
      },
      async () => {
        if (!request.refreshToken) {
          throw new ConnectError('refresh_token is required', Code.InvalidArgument);
        }

        const userId = await runInSpan(
          'RefreshTokenRepository.rotate',
          {
            'notary.operation': 'auth.refresh_token.rotate',
            'notary.entity': 'AuthSession',
            'db.operation': 'update',
          },
          () => this.refreshTokenRepository.rotate(request.refreshToken),
        );
        if (!userId) {
          throw new ConnectError('refresh token is invalid or expired', Code.Unauthenticated);
        }

        const record = await runInSpan(
          'AuthRepository.findById refresh',
          {
            'notary.operation': 'auth.repository.lookup',
            'notary.entity': 'User',
            'db.operation': 'select',
          },
          () => this.authRepository.findById(userId),
        );
        if (!record || !record.isActive) {
          throw new ConnectError('user not found or deactivated', Code.Unauthenticated);
        }

        const rpcUser = this.authRepository.toMessage(record);
        const { accessToken, refreshToken, refreshExpiresAt } = await runInSpan(
          'TokenService.generateTokenPair refresh',
          {
            'notary.operation': 'auth.token_pair.generate',
            'notary.entity': 'AuthSession',
            'notary.actor.role': normalizeSpanActorRole(rpcUser.role),
          },
          () =>
            this.tokenService.generateTokenPair({
              sub: rpcUser.id,
              email: rpcUser.email,
              role: rpcUser.role.toString(),
            }),
        );

        await runInSpan(
          'RefreshTokenRepository.save refresh',
          {
            'notary.operation': 'auth.refresh_token.save',
            'notary.entity': 'AuthSession',
            'db.operation': 'insert',
          },
          () => this.refreshTokenRepository.save(userId, refreshToken, refreshExpiresAt),
        );

        return create(RefreshTokenResponseSchema, {
          result: create(AuthResultSchema, { accessToken, refreshToken, user: rpcUser }),
        });
      },
    );
  }

  // ─── Logout ──────────────────────────────────────────────────────────────

  async logout(request: LogoutRequest): Promise<LogoutResponse> {
    return runInSpan(
      'AuthService.logout',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.authLogout,
        [NotarySpanAttributes.entity]: 'AuthSession',
      },
      async () => {
        if (!request.refreshToken) {
          throw new ConnectError('refresh_token is required', Code.InvalidArgument);
        }

        const revoked = await runInSpan(
          'RefreshTokenRepository.revoke',
          {
            'notary.operation': 'auth.refresh_token.revoke',
            'notary.entity': 'AuthSession',
            'db.operation': 'update',
          },
          () => this.refreshTokenRepository.revoke(request.refreshToken),
        );
        return create(LogoutResponseSchema, { success: revoked });
      },
    );
  }

  // ─── Forgot password (email link) ───────────────────────────────────────

  /** Не раскрывает, существует ли email: при отсутствии пользователя — тихий успех. */
  async forgotPassword(request: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    return runInSpan(
      'AuthService.forgotPassword',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.authForgotPassword,
        [NotarySpanAttributes.entity]: 'PasswordReset',
      },
      async () => {
        const email = (request.email ?? '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) {
          await this.recordPasswordResetFailed('request', 'invalid_email', email);
          return create(ForgotPasswordResponseSchema, {});
        }

        const record = await runInSpan(
          'AuthRepository.findByEmail password reset',
          {
            'notary.operation': 'auth.repository.lookup',
            'notary.entity': 'User',
            'db.operation': 'select',
          },
          () => this.authRepository.findByEmail(email),
        );
        if (!record?.isActive) {
          await this.recordPasswordResetFailed(
            'request',
            'user_not_found_or_inactive',
            email,
            record,
          );
          return create(ForgotPasswordResponseSchema, {});
        }

        const rawToken = this.tokenService.generatePasswordResetToken();
        const ttlSec = Number(process.env['PASSWORD_RESET_TTL_SEC'] ?? 3600);
        const expiresAt = new Date(Date.now() + ttlSec * 1000);
        await runInSpan(
          'PasswordResetRepository.create',
          {
            'notary.operation': 'auth.password_reset.create',
            'notary.entity': 'PasswordReset',
            'db.operation': 'insert',
          },
          () => this.passwordResetRepository.create(record.id, rawToken, expiresAt),
        );
        await this.recordPasswordResetRequested(record, expiresAt);

        const base = (
          process.env['PASSWORD_RESET_BASE_URL'] ??
          process.env['FRONTEND_URL'] ??
          'http://localhost:4200'
        ).replace(/\/$/, '');
        const resetUrl = `${base}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;

        const passwordResetMailer = this.passwordResetMailer;
        if (passwordResetMailer) {
          void runInSpan(
            'PasswordResetMailer.sendResetLink',
            {
              'notary.operation': 'auth.mail.send_password_reset',
              'notary.entity': 'PasswordReset',
            },
            (mailSpan) =>
              passwordResetMailer.sendResetLink(record.email, resetUrl).catch((err: unknown) => {
                setSpanAttributes(mailSpan, {
                  'auth.mail.delivery': 'failed',
                  'notary.side_effect.result': 'error',
                });
                throw err;
              }),
          ).catch((err: unknown) => {
            this.logger.warn(
              `Auth mail delivery failed; operation=auth.mail.send_password_reset; result=error; error=${safeErrorName(err)}`,
            );
          });
        } else {
          console.warn('[Auth] PASSWORD_RESET_MAILER не настроен; ссылка сброса пароля не логируется');
        }

        return create(ForgotPasswordResponseSchema, {});
      },
    );
  }

  async resetPassword(request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    return runInSpan(
      'AuthService.resetPassword',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.authResetPassword,
        [NotarySpanAttributes.entity]: 'PasswordReset',
      },
      async () => {
        const token = request.token?.trim();
        if (!token) {
          await this.recordPasswordResetFailed('submit', 'token_required');
          throw new ConnectError('token is required', Code.InvalidArgument);
        }
        if (request.newPassword.length < MIN_PASSWORD_LEN) {
          await this.recordPasswordResetFailed('submit', 'weak_password');
          throw new ConnectError(
            `password must be at least ${MIN_PASSWORD_LEN} characters`,
            Code.InvalidArgument,
          );
        }

        const stored = await runInSpan(
          'PasswordResetRepository.findValid',
          {
            'notary.operation': 'auth.password_reset.lookup',
            'notary.entity': 'PasswordReset',
            'db.operation': 'select',
          },
          () => this.passwordResetRepository.findValid(token),
        );
        if (!stored) {
          await this.recordPasswordResetFailed('submit', 'invalid_or_expired_token');
          throw new ConnectError('invalid or expired reset token', Code.InvalidArgument);
        }

        const record = await runInSpan(
          'AuthRepository.findById reset',
          {
            'notary.operation': 'auth.repository.lookup',
            'notary.entity': 'User',
            'db.operation': 'select',
          },
          () => this.authRepository.findById(stored.userId),
        );
        if (!record) {
          await this.recordPasswordResetFailed('submit', 'user_not_found');
          throw new ConnectError('invalid or expired reset token', Code.InvalidArgument);
        }

        const passwordHash = await runInSpan(
          'PasswordService.hash reset',
          {
            'notary.operation': 'auth.password.hash',
            'notary.entity': 'User',
          },
          () => this.passwordService.hash(request.newPassword),
        );
        await runInSpan(
          'AuthRepository.updatePasswordHash',
          {
            'notary.operation': 'auth.repository.update_password',
            'notary.entity': 'User',
            'db.operation': 'update',
          },
          () => this.authRepository.updatePasswordHash(stored.userId, passwordHash),
        );
        await runInSpan(
          'PasswordResetRepository.markUsed',
          {
            'notary.operation': 'auth.password_reset.mark_used',
            'notary.entity': 'PasswordReset',
            'db.operation': 'update',
          },
          () => this.passwordResetRepository.markUsed(stored.id),
        );
        await runInSpan(
          'RefreshTokenRepository.revokeAll',
          {
            'notary.operation': 'auth.refresh_token.revoke_all',
            'notary.entity': 'AuthSession',
            'db.operation': 'update',
          },
          () => this.refreshTokenRepository.revokeAll(stored.userId),
        );
        await this.recordPasswordResetCompleted(record);

        return create(ResetPasswordResponseSchema, {});
      },
    );
  }

  private async recordRegistered(user: AuthAuditUser): Promise<void> {
    await this.auditService.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorName: user.fullName,
      actorRole: toAuditRole(user.role),
      eventType: REGISTERED_EVENT,
      targetType: 'User',
      targetId: user.id,
      actionTitle: 'Зарегистрирован пользователь',
      actionContext: 'Аккаунт создан через форму регистрации',
      targetTitle: user.fullName || user.email,
      targetContext: user.email,
      after: authDetails({
        outcome: 'succeeded',
        email: user.email,
        role: roleDetail(user.role),
      }),
    });
  }

  private async notifyAdminsAboutRegistrationBestEffort(user: AuthAuditUser): Promise<void> {
    try {
      const displayName = user.fullName?.trim() || user.email;
      await this.notificationService.createInternalNotificationsForRole(PrismaRole.Admin, {
        title: 'Новый пользователь зарегистрировался',
        message: `${displayName} создал аккаунт (${roleLabelForRpc(toRpcRole(user.role))}). Проверьте профиль пользователя.`,
        type: RpcNotificationType.IN_APP,
      });
    } catch (error) {
      this.logger.warn(
        `Auth notification failed; operation=auth.registration.notify_admins; result=error; error=${safeErrorName(error)}`,
      );
    }
  }

  private async recordRegistrationFailure(
    email: string,
    reason: string,
    role?: RpcUserRole | PrismaRole | string | number | null,
    targetUser?: AuthAuditUser | null,
  ): Promise<void> {
    this.metrics.recordAuthRegistration('failed', metricRole(role), reason);
    await this.auditService.record({
      actorEmail: normalizeAuditEmail(email),
      actorName: targetUser?.fullName,
      actorRole: targetUser ? toAuditRole(targetUser.role) : undefined,
      allowAnonymous: true,
      eventType: REGISTRATION_FAILED_EVENT,
      targetType: targetUser ? 'User' : 'Security',
      targetId: targetUser?.id ?? null,
      actionTitle: 'Ошибка регистрации',
      actionContext: reasonLabel(reason),
      targetTitle: targetUser?.fullName || targetUser?.email || 'Registration attempt',
      targetContext: normalizeAuditEmail(email),
      after: authDetails({
        outcome: 'failed',
        reason,
        email: normalizeAuditEmail(email),
        role: roleDetail(role),
      }),
    });
  }

  private async recordLoginSucceeded(user: AuthAuditUser): Promise<void> {
    this.metrics.recordAuthLogin('success');
    await this.auditService.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorName: user.fullName,
      actorRole: toAuditRole(user.role),
      eventType: LOGIN_SUCCEEDED_EVENT,
      targetType: 'User',
      targetId: user.id,
      actionTitle: 'Успешный вход',
      actionContext: 'Пользователь вошёл в аккаунт',
      targetTitle: user.fullName || user.email,
      targetContext: user.email,
      after: authDetails({
        outcome: 'succeeded',
        email: user.email,
        role: roleDetail(user.role),
      }),
    });
  }

  private async recordLoginFailure(
    email: string,
    reason: string,
    targetUser?: AuthAuditUser | null,
  ): Promise<void> {
    this.metrics.recordAuthLogin('failed', reason);
    await this.auditService.record({
      actorEmail: normalizeAuditEmail(email),
      actorName: targetUser?.fullName,
      actorRole: targetUser ? toAuditRole(targetUser.role) : undefined,
      allowAnonymous: true,
      eventType: LOGIN_FAILED_EVENT,
      targetType: targetUser ? 'User' : 'Security',
      targetId: targetUser?.id ?? null,
      actionTitle: 'Неудачная попытка входа',
      actionContext: reasonLabel(reason),
      targetTitle: targetUser?.fullName || targetUser?.email || 'Login attempt',
      targetContext: normalizeAuditEmail(email),
      after: authDetails({
        outcome: 'failed',
        reason,
        email: normalizeAuditEmail(email),
        role: roleDetail(targetUser?.role),
      }),
    });
  }

  private async recordPasswordResetRequested(user: AuthAuditUser, expiresAt: Date): Promise<void> {
    this.metrics.recordAuthPasswordReset('request', 'success');
    await this.auditService.record({
      actorEmail: user.email,
      actorName: user.fullName,
      actorRole: toAuditRole(user.role),
      allowAnonymous: true,
      eventType: PASSWORD_RESET_REQUESTED_EVENT,
      targetType: 'User',
      targetId: user.id,
      actionTitle: 'Запрошено восстановление пароля',
      actionContext: 'Создана ссылка восстановления пароля',
      targetTitle: user.fullName || user.email,
      targetContext: user.email,
      after: authDetails({
        outcome: 'succeeded',
        email: user.email,
        role: roleDetail(user.role),
        expiresAt: expiresAt.toISOString(),
      }),
    });
  }

  private async recordPasswordResetFailed(
    stage: 'request' | 'submit',
    reason: string,
    email?: string,
    targetUser?: AuthAuditUser | null,
  ): Promise<void> {
    this.metrics.recordAuthPasswordReset(stage, 'failed', reason);
    await this.auditService.record({
      actorEmail: normalizeAuditEmail(email),
      actorName: targetUser?.fullName,
      actorRole: targetUser ? toAuditRole(targetUser.role) : undefined,
      allowAnonymous: true,
      eventType: PASSWORD_RESET_FAILED_EVENT,
      targetType: targetUser ? 'User' : 'Security',
      targetId: targetUser?.id ?? null,
      actionTitle: 'Ошибка восстановления пароля',
      actionContext: reasonLabel(reason),
      targetTitle: targetUser?.fullName || targetUser?.email || 'Password reset attempt',
      targetContext: normalizeAuditEmail(email),
      after: authDetails({
        outcome: 'failed',
        reason,
        email: normalizeAuditEmail(email),
        role: roleDetail(targetUser?.role),
      }),
    });
  }

  private async recordPasswordResetCompleted(user: AuthAuditUser): Promise<void> {
    this.metrics.recordAuthPasswordReset('submit', 'success');
    await this.auditService.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorName: user.fullName,
      actorRole: toAuditRole(user.role),
      eventType: PASSWORD_RESET_COMPLETED_EVENT,
      targetType: 'User',
      targetId: user.id,
      actionTitle: 'Пароль восстановлен',
      actionContext: 'Пользователь установил новый пароль по ссылке восстановления',
      targetTitle: user.fullName || user.email,
      targetContext: user.email,
      after: authDetails({
        outcome: 'succeeded',
        email: user.email,
        role: roleDetail(user.role),
      }),
    });
  }
}

function normalizeAuditEmail(email: string | null | undefined): string | undefined {
  const normalized = email?.trim().toLowerCase();
  return normalized || undefined;
}

function authDetails(
  values: Record<string, string | number | boolean | null | undefined>,
): Prisma.JsonObject {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ) as Prisma.JsonObject;
}

function toAuditRole(
  role: RpcUserRole | PrismaRole | string | number | null | undefined,
): PrismaRole | undefined {
  switch (String(role ?? '')) {
    case '1':
    case 'USER_ROLE_APPLICANT':
    case PrismaRole.Applicant:
      return PrismaRole.Applicant;
    case '2':
    case 'USER_ROLE_NOTARY':
    case PrismaRole.Notary:
      return PrismaRole.Notary;
    case '3':
    case 'USER_ROLE_ADMIN':
    case PrismaRole.Admin:
      return PrismaRole.Admin;
    default:
      return undefined;
  }
}

function roleDetail(
  role: RpcUserRole | PrismaRole | string | number | null | undefined,
): string | undefined {
  return toAuditRole(role)?.toString();
}

function metricRole(role: RpcUserRole | PrismaRole | string | number | null | undefined): string {
  const auditRole = toAuditRole(role);
  if (!auditRole) {
    return 'unspecified';
  }

  return auditRole.toString().toLowerCase();
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'invalid_email':
      return 'Некорректный email';
    case 'weak_password':
      return 'Пароль короче минимальной длины';
    case 'full_name_required':
      return 'Не указано ФИО';
    case 'admin_role_denied':
      return 'Запрещена самостоятельная регистрация администратора';
    case 'email_already_registered':
      return 'Email уже зарегистрирован';
    case 'missing_credentials':
      return 'Не переданы email или пароль';
    case 'user_not_found':
      return 'Пользователь не найден';
    case 'account_deactivated':
      return 'Аккаунт деактивирован';
    case 'invalid_password':
      return 'Неверный пароль';
    case 'oauth_only_account':
      return 'Аккаунт без пароля (вход через внешний сервис)';
    case 'user_not_found_or_inactive':
      return 'Пользователь не найден или неактивен';
    case 'token_required':
      return 'Не передан reset token';
    case 'invalid_or_expired_token':
      return 'Reset token не найден или истёк';
    default:
      return reason;
  }
}

function safeErrorName(error: unknown): string {
  return error instanceof Error && error.name.trim() ? error.name : 'UnknownError';
}
