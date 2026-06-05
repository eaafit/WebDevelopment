import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '@internal/audit';
import { OAuthProvider as PrismaOAuthProvider, Prisma, Role as PrismaRole } from '@internal/prisma-client';
import {
  AuthResultSchema,
  GetOAuthAuthorizeUrlResponseSchema,
  OAuthLoginResponseSchema,
  OauthProvider,
  type GetOAuthAuthorizeUrlRequest,
  type GetOAuthAuthorizeUrlResponse,
  type OAuthLoginRequest,
  type OAuthLoginResponse,
} from '@notary-portal/api-contracts';
import { AuthRepository } from './auth.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';
import { GoogleOAuthClient } from './google-oauth.client';
import { YandexOAuthClient } from './yandex-oauth.client';
import { VkOAuthClient } from './vk-oauth.client';
import type { OAuthClient, OAuthUserInfo } from './oauth-client';
import { OAuthAccountRepository, type OAuthUserRecord } from './oauth-account.repository';
import { OAuthStateService } from './oauth-state.service';

const OAUTH_LOGIN_SUCCEEDED_EVENT = 'user.oauth_login_succeeded';
const OAUTH_LOGIN_FAILED_EVENT = 'user.oauth_login_failed';
const OAUTH_REGISTERED_EVENT = 'user.oauth_registered';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  /** Реестр сетевых клиентов по провайдеру. Новый провайдер = новая запись. */
  private readonly clients: Map<OauthProvider, OAuthClient>;

  constructor(
    googleClient: GoogleOAuthClient,
    yandexClient: YandexOAuthClient,
    vkClient: VkOAuthClient,
    private readonly stateService: OAuthStateService,
    private readonly oauthAccountRepository: OAuthAccountRepository,
    private readonly authRepository: AuthRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {
    this.clients = new Map<OauthProvider, OAuthClient>([
      [OauthProvider.GOOGLE, googleClient],
      [OauthProvider.YANDEX, yandexClient],
      [OauthProvider.VK, vkClient],
    ]);
  }

  // ─── Authorize URL ─────────────────────────────────────────────────────────

  async getAuthorizeUrl(
    request: GetOAuthAuthorizeUrlRequest,
  ): Promise<GetOAuthAuthorizeUrlResponse> {
    const client = this.resolveClient(request.provider);

    // PKCE (VK ID): verifier прячем в подписанный state, challenge кладём в URL.
    const pkce = client.createPkce?.();
    const state = this.stateService.issue(pkce?.verifier);
    const url = client.buildAuthorizeUrl(state, pkce?.challenge);

    return create(GetOAuthAuthorizeUrlResponseSchema, { url, state });
  }

  // ─── Login / Register ────────────────────────────────────────────────────

  async login(request: OAuthLoginRequest): Promise<OAuthLoginResponse> {
    const client = this.resolveClient(request.provider);

    // 1. CSRF state. verify возвращает встроенный payload (PKCE code_verifier).
    let codeVerifier: string;
    try {
      codeVerifier = this.stateService.verify(request.state);
    } catch {
      await this.recordFailure(request.provider, 'invalid_state');
      throw new ConnectError('invalid oauth state', Code.Unauthenticated);
    }

    // 2. Обмен code → токены и профиль провайдера (токены наружу не отдаём).
    let profile: OAuthUserInfo;
    try {
      const tokens = await client.exchangeCode({
        code: request.code,
        codeVerifier: codeVerifier || undefined,
        deviceId: request.deviceId || undefined,
      });
      profile = await client.getUserInfo(tokens.accessToken);
    } catch (error) {
      this.logger.warn(
        `OAuth exchange failed (${providerLabel(request.provider)}): ${describeError(error)}`,
      );
      await this.recordFailure(request.provider, 'provider_exchange_failed');
      throw new ConnectError('oauth authentication failed', Code.Unauthenticated);
    }

    // 3. find-or-create + выдача наших JWT.
    return this.completeLogin(request.provider, profile);
  }

  private async completeLogin(
    provider: OauthProvider,
    profile: OAuthUserInfo,
  ): Promise<OAuthLoginResponse> {
    const prismaProvider = PRISMA_PROVIDER[provider];
    if (!prismaProvider) {
      throw new ConnectError('OAuth provider is not supported', Code.Unimplemented);
    }

    // Провайдер не вернул email → не создаём пользователя без него (User.email unique).
    if (!profile.email) {
      await this.recordFailure(provider, 'no_email');
      throw new ConnectError('provider did not return an email', Code.Unauthenticated);
    }

    // 3a. Уже привязанный внешний аккаунт → обычный вход.
    const linked = await this.oauthAccountRepository.findUserByProviderAccount(
      prismaProvider,
      profile.providerUserId,
    );
    if (linked) {
      await this.assertActive(provider, linked);
      await this.recordSuccess(OAUTH_LOGIN_SUCCEEDED_EVENT, provider, linked, false);
      return this.issueTokens(linked);
    }

    // 3b. Существующий парольный аккаунт по email → связываем (только если email подтверждён).
    const byEmail = await this.authRepository.findByEmail(profile.email);
    if (byEmail) {
      if (!profile.emailVerified) {
        await this.recordFailure(provider, 'email_not_verified', profile.email, byEmail);
        throw new ConnectError(
          'email is registered but not verified by the provider',
          Code.PermissionDenied,
        );
      }
      await this.assertActive(provider, byEmail);
      await this.oauthAccountRepository.linkAccount(
        byEmail.id,
        prismaProvider,
        profile.providerUserId,
      );
      await this.recordSuccess(OAUTH_LOGIN_SUCCEEDED_EVENT, provider, byEmail, true);
      return this.issueTokens(byEmail);
    }

    // 3c. Новый пользователь → создаём (роль Applicant, без пароля) + связку.
    const created = await this.oauthAccountRepository.createUserWithAccount(
      { email: profile.email, fullName: profile.fullName, role: PrismaRole.Applicant },
      prismaProvider,
      profile.providerUserId,
    );
    await this.recordSuccess(OAUTH_REGISTERED_EVENT, provider, created, false);
    return this.issueTokens(created);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private resolveClient(provider: OauthProvider): OAuthClient {
    const client = this.clients.get(provider);
    if (!client) {
      throw new ConnectError(
        `OAuth provider ${providerLabel(provider)} is not implemented`,
        Code.Unimplemented,
      );
    }
    return client;
  }

  private async assertActive(provider: OauthProvider, user: OAuthUserRecord): Promise<void> {
    if (!user.isActive) {
      await this.recordFailure(provider, 'account_deactivated', user.email, user);
      throw new ConnectError('account is deactivated', Code.PermissionDenied);
    }
  }

  private async issueTokens(record: OAuthUserRecord): Promise<OAuthLoginResponse> {
    const rpcUser = this.authRepository.toMessage(record);
    const { accessToken, refreshToken, refreshExpiresAt } = this.tokenService.generateTokenPair({
      sub: rpcUser.id,
      email: rpcUser.email,
      role: rpcUser.role.toString(),
    });

    await this.refreshTokenRepository.save(rpcUser.id, refreshToken, refreshExpiresAt);

    return create(OAuthLoginResponseSchema, {
      result: create(AuthResultSchema, { accessToken, refreshToken, user: rpcUser }),
    });
  }

  private async recordSuccess(
    eventType: string,
    provider: OauthProvider,
    user: OAuthUserRecord,
    linked: boolean,
  ): Promise<void> {
    const registered = eventType === OAUTH_REGISTERED_EVENT;
    await this.auditService.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorName: user.fullName,
      actorRole: user.role,
      eventType,
      targetType: 'User',
      targetId: user.id,
      actionTitle: registered
        ? 'Регистрация через внешний сервис'
        : 'Успешный вход через внешний сервис',
      actionContext: registered
        ? `Аккаунт создан через ${providerLabel(provider)}`
        : `Вход через ${providerLabel(provider)}${linked ? ' (привязка к существующему аккаунту)' : ''}`,
      targetTitle: user.fullName || user.email,
      targetContext: user.email,
      after: authDetails({
        provider: providerLabel(provider),
        outcome: 'succeeded',
        linked,
        email: user.email,
        role: user.role.toString(),
      }),
    });
  }

  private async recordFailure(
    provider: OauthProvider,
    reason: string,
    email?: string,
    user?: OAuthUserRecord,
  ): Promise<void> {
    const normalizedEmail = email?.trim().toLowerCase() || undefined;
    await this.auditService.record({
      actorEmail: normalizedEmail,
      actorName: user?.fullName,
      actorRole: user?.role,
      allowAnonymous: true,
      eventType: OAUTH_LOGIN_FAILED_EVENT,
      targetType: user ? 'User' : 'Security',
      targetId: user?.id ?? null,
      actionTitle: 'Неудачный вход через внешний сервис',
      actionContext: reasonLabel(reason),
      targetTitle: user?.fullName || user?.email || 'OAuth login attempt',
      targetContext: normalizedEmail,
      after: authDetails({
        provider: providerLabel(provider),
        outcome: 'failed',
        reason,
        email: normalizedEmail,
      }),
    });
  }
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

/** Маппинг proto-провайдера в Prisma-enum. Отсутствие = провайдер не поддержан. */
const PRISMA_PROVIDER: Partial<Record<OauthProvider, PrismaOAuthProvider>> = {
  [OauthProvider.GOOGLE]: PrismaOAuthProvider.Google,
  [OauthProvider.YANDEX]: PrismaOAuthProvider.Yandex,
  [OauthProvider.VK]: PrismaOAuthProvider.Vk,
};

function providerLabel(provider: OauthProvider): string {
  switch (provider) {
    case OauthProvider.GOOGLE:
      return 'google';
    case OauthProvider.YANDEX:
      return 'yandex';
    case OauthProvider.VK:
      return 'vk';
    default:
      return 'unknown';
  }
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'invalid_state':
      return 'Невалидный или просроченный state (CSRF)';
    case 'provider_exchange_failed':
      return 'Ошибка обмена с провайдером';
    case 'email_not_verified':
      return 'Email не подтверждён провайдером';
    case 'no_email':
      return 'Провайдер не вернул email';
    case 'account_deactivated':
      return 'Аккаунт деактивирован';
    default:
      return reason;
  }
}

/** Сборка JSON-деталей аудита без секретов; пустые значения отбрасываются. */
function authDetails(
  values: Record<string, string | number | boolean | null | undefined>,
): Prisma.JsonObject {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ) as Prisma.JsonObject;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}
