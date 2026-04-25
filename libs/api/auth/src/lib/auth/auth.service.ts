import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { MetricsService } from '@internal/metrics';
import {
  AuthResultSchema,
  ForgotPasswordResponseSchema,
  LoginResponseSchema,
  LogoutResponseSchema,
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

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly metrics: MetricsService,
    @Optional()
    @Inject(PASSWORD_RESET_MAILER)
    private readonly passwordResetMailer: PasswordResetMailer | null = null,
    @Optional()
    @Inject(TRANSACTIONAL_MAILER)
    private readonly transactionalMailer: TransactionalMailer | null = null,
  ) {}

  // ─── Register ────────────────────────────────────────────────────────────

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    if (!EMAIL_RE.test(request.email)) {
      throw new ConnectError('email is invalid', Code.InvalidArgument);
    }
    if (request.password.length < MIN_PASSWORD_LEN) {
      throw new ConnectError(
        `password must be at least ${MIN_PASSWORD_LEN} characters`,
        Code.InvalidArgument,
      );
    }
    if (!request.fullName?.trim()) {
      throw new ConnectError('full_name is required', Code.InvalidArgument);
    }
    if (request.role === RpcUserRole.ADMIN) {
      throw new ConnectError('cannot self-register as admin', Code.PermissionDenied);
    }

    const existing = await this.authRepository.findByEmail(request.email.toLowerCase());
    if (existing) {
      throw new ConnectError('email already registered', Code.AlreadyExists);
    }

    const passwordHash = await this.passwordService.hash(request.password);
    const user = await this.authRepository.createUser({
      email: request.email.toLowerCase(),
      passwordHash,
      fullName: request.fullName.trim(),
      phoneNumber: request.phoneNumber?.trim() || undefined,
      role: this.authRepository.toPrismaRole(request.role),
    });

    const { accessToken, refreshToken, refreshExpiresAt } = this.tokenService.generateTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role.toString(),
    });

    await this.refreshTokenRepository.save(user.id, refreshToken, refreshExpiresAt);

    this.metrics.recordUserRegistered();

    if (this.transactionalMailer) {
      const base = (process.env['FRONTEND_URL'] ?? 'http://localhost:4200').replace(/\/$/, '');
      void this.transactionalMailer
        .sendWelcomeAfterRegistration({
          email: user.email,
          fullName: user.fullName,
          roleLabel: roleLabelForRpc(user.role),
          loginUrl: `${base}/auth`,
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn('[Auth] welcome email failed:', msg);
        });
    }

    return create(RegisterResponseSchema, {
      result: create(AuthResultSchema, { accessToken, refreshToken, user }),
    });
  }

  // ─── Login ───────────────────────────────────────────────────────────────

  async login(request: LoginRequest): Promise<LoginResponse> {
    if (!request.email || !request.password) {
      throw new ConnectError('email and password are required', Code.InvalidArgument);
    }

    const record = await this.authRepository.findByEmail(request.email.toLowerCase());
    if (!record) {
      throw new ConnectError('invalid credentials', Code.Unauthenticated);
    }
    if (!record.isActive) {
      throw new ConnectError('account is deactivated', Code.PermissionDenied);
    }

    const passwordValid = await this.passwordService.compare(request.password, record.passwordHash);
    if (!passwordValid) {
      throw new ConnectError('invalid credentials', Code.Unauthenticated);
    }

    const user = this.authRepository.toMessage(record);
    const { accessToken, refreshToken, refreshExpiresAt } = this.tokenService.generateTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role.toString(),
    });

    await this.refreshTokenRepository.save(user.id, refreshToken, refreshExpiresAt);

    return create(LoginResponseSchema, {
      result: create(AuthResultSchema, { accessToken, refreshToken, user }),
    });
  }

  // ─── RefreshToken ────────────────────────────────────────────────────────

  async refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    if (!request.refreshToken) {
      throw new ConnectError('refresh_token is required', Code.InvalidArgument);
    }

    // Ротация: старый токен отзывается атомарно, возвращается userId
    const userId = await this.refreshTokenRepository.rotate(request.refreshToken);
    if (!userId) {
      throw new ConnectError('refresh token is invalid or expired', Code.Unauthenticated);
    }

    // Загружаем актуальные данные — роль/статус могли измениться
    const record = await this.authRepository.findById(userId);
    if (!record || !record.isActive) {
      throw new ConnectError('user not found or deactivated', Code.Unauthenticated);
    }

    const rpcUser = this.authRepository.toMessage(record);
    const { accessToken, refreshToken, refreshExpiresAt } = this.tokenService.generateTokenPair({
      sub: rpcUser.id,
      email: rpcUser.email,
      role: rpcUser.role.toString(),
    });

    await this.refreshTokenRepository.save(userId, refreshToken, refreshExpiresAt);

    return create(RefreshTokenResponseSchema, {
      result: create(AuthResultSchema, { accessToken, refreshToken, user: rpcUser }),
    });
  }

  // ─── Logout ──────────────────────────────────────────────────────────────

  async logout(request: LogoutRequest): Promise<LogoutResponse> {
    if (!request.refreshToken) {
      throw new ConnectError('refresh_token is required', Code.InvalidArgument);
    }

    // Идемпотентный logout — не бросаем ошибку если токен уже отозван
    const revoked = await this.refreshTokenRepository.revoke(request.refreshToken);
    return create(LogoutResponseSchema, { success: revoked });
  }

  // ─── Forgot password (email link) ───────────────────────────────────────

  /** Не раскрывает, существует ли email: при отсутствии пользователя — тихий успех. */
  async forgotPassword(request: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const email = request.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return create(ForgotPasswordResponseSchema, {});
    }

    const record = await this.authRepository.findByEmail(email);
    if (!record?.isActive) {
      return create(ForgotPasswordResponseSchema, {});
    }

    const rawToken = this.tokenService.generatePasswordResetToken();
    const ttlSec = Number(process.env['PASSWORD_RESET_TTL_SEC'] ?? 3600);
    const expiresAt = new Date(Date.now() + ttlSec * 1000);
    await this.passwordResetRepository.create(record.id, rawToken, expiresAt);

    const base = (
      process.env['PASSWORD_RESET_BASE_URL'] ??
      process.env['FRONTEND_URL'] ??
      'http://localhost:4200'
    ).replace(/\/$/, '');
    const resetUrl = `${base}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;

    if (this.passwordResetMailer) {
      await this.passwordResetMailer.sendResetLink(record.email, resetUrl);
    } else {
      console.warn('[Auth] PASSWORD_RESET_MAILER не настроен — ссылка сброса пароля:', resetUrl);
    }

    return create(ForgotPasswordResponseSchema, {});
  }

  async resetPassword(request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    const token = request.token?.trim();
    if (!token) {
      throw new ConnectError('token is required', Code.InvalidArgument);
    }
    if (request.newPassword.length < MIN_PASSWORD_LEN) {
      throw new ConnectError(
        `password must be at least ${MIN_PASSWORD_LEN} characters`,
        Code.InvalidArgument,
      );
    }

    const stored = await this.passwordResetRepository.findValid(token);
    if (!stored) {
      throw new ConnectError('invalid or expired reset token', Code.InvalidArgument);
    }

    const passwordHash = await this.passwordService.hash(request.newPassword);
    await this.authRepository.updatePasswordHash(stored.userId, passwordHash);
    await this.passwordResetRepository.markUsed(stored.id);
    await this.refreshTokenRepository.revokeAll(stored.userId);

    return create(ResetPasswordResponseSchema, {});
  }
}
