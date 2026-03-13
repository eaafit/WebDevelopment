import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { Injectable } from '@nestjs/common';
import {
  AuthResultSchema,
  LoginResponseSchema,
  LogoutResponseSchema,
  RegisterResponseSchema,
  RefreshTokenResponseSchema,
  UserRole as RpcUserRole,
  type LoginRequest,
  type LoginResponse,
  type LogoutRequest,
  type LogoutResponse,
  type RefreshTokenRequest,
  type RefreshTokenResponse,
  type RegisterRequest,
  type RegisterResponse,
} from '@notary-portal/api-contracts';
import { AuthRepository } from './auth.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
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
      email:        request.email.toLowerCase(),
      passwordHash,
      fullName:     request.fullName.trim(),
      phoneNumber:  request.phoneNumber?.trim() || undefined,
      role:         this.authRepository.toPrismaRole(request.role),
    });

    const { accessToken, refreshToken, refreshExpiresAt } =
      this.tokenService.generateTokenPair({
        sub:   user.id,
        email: user.email,
        role:  user.role.toString(),
      });

    await this.refreshTokenRepository.save(user.id, refreshToken, refreshExpiresAt);

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

    const passwordValid = await this.passwordService.compare(
      request.password,
      record.passwordHash,
    );
    if (!passwordValid) {
      throw new ConnectError('invalid credentials', Code.Unauthenticated);
    }

    const user = this.authRepository.toMessage(record);
    const { accessToken, refreshToken, refreshExpiresAt } =
      this.tokenService.generateTokenPair({
        sub:   user.id,
        email: user.email,
        role:  user.role.toString(),
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
    const { accessToken, refreshToken, refreshExpiresAt } =
      this.tokenService.generateTokenPair({
        sub:   rpcUser.id,
        email: rpcUser.email,
        role:  rpcUser.role.toString(),
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
}
