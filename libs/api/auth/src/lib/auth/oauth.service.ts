import { randomInt } from 'crypto';
import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '@internal/audit';
import { NotificationService } from '@internal/notification';
import { OAuthProvider as PrismaOAuthProvider, Prisma, Role as PrismaRole } from '@internal/prisma-client';
import {
  AuthResultSchema,
  ConfirmContactResponseSchema,
  GetOAuthAuthorizeUrlResponseSchema,
  NotificationCategory as RpcNotificationCategory,
  NotificationType as RpcNotificationType,
  OAuthLoginResponseSchema,
  OauthProvider,
  ResendContactCodeResponseSchema,
  type AuthResult,
  type ConfirmContactRequest,
  type ConfirmContactResponse,
  type GetOAuthAuthorizeUrlRequest,
  type GetOAuthAuthorizeUrlResponse,
  type OAuthLoginRequest,
  type OAuthLoginResponse,
  type ResendContactCodeRequest,
  type ResendContactCodeResponse,
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
import { ContactVerificationRepository } from './contact-verification.repository';
import { CONTACT_CODE_MAILER, type ContactCodeMailer } from './contact-code-mailer.interface';

const OAUTH_LOGIN_SUCCEEDED_EVENT = 'user.oauth_login_succeeded';
const OAUTH_LOGIN_FAILED_EVENT = 'user.oauth_login_failed';
const OAUTH_REGISTERED_EVENT = 'user.oauth_registered';
const CONTACT_VERIFICATION_SENT_EVENT = 'user.contact_verification_sent';
const CONTACT_CONFIRMED_EVENT = 'user.contact_confirmed';
const CONTACT_CONFIRMATION_FAILED_EVENT = 'user.contact_confirmation_failed';

/** Минимальная проекция юзера для подтверждения контакта (id+email+аудит-поля). */
interface ContactUser {
  id: string;
  email: string;
  fullName: string;
  role: PrismaRole;
}

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
    private readonly contactVerificationRepository: ContactVerificationRepository,
    @Inject(CONTACT_CODE_MAILER) private readonly codeMailer: ContactCodeMailer,
    private readonly notificationService: NotificationService,
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

    // 3a. Уже привязанный внешний аккаунт → обычный вход (если контакт уже подтверждён).
    const linked = await this.oauthAccountRepository.findUserByProviderAccount(
      prismaProvider,
      profile.providerUserId,
    );
    if (linked) {
      await this.assertActive(provider, linked);
      // Юзер бросил подтверждение при регистрации/связке → снова требуем код.
      if (await this.needsVerification(linked.id)) {
        return this.requireVerification(linked);
      }
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
      // Первая связка → не в кабинет, а на подтверждение контакта кодом.
      return this.requireVerification(byEmail);
    }

    // 3c. Новый пользователь → создаём (роль Applicant, без пароля) + связку.
    const created = await this.oauthAccountRepository.createUserWithAccount(
      { email: profile.email, fullName: profile.fullName, role: PrismaRole.Applicant },
      prismaProvider,
      profile.providerUserId,
    );
    await this.recordSuccess(OAUTH_REGISTERED_EVENT, provider, created, false);
    // Новая регистрация → подтверждение контакта кодом перед входом.
    return this.requireVerification(created);
  }

  // ─── Подтверждение контакта (после OAuth-регистрации / первой связки) ─────

  /** true — у юзера есть неподтверждённая запись подтверждения контакта. */
  private async needsVerification(userId: string): Promise<boolean> {
    const record = await this.contactVerificationRepository.findByUserId(userId);
    return !!record && !record.confirmedAt;
  }

  /** Выпускает код, шлёт в лог, пишет аудит, отдаёт фронту verification_required + ticket. */
  private async requireVerification(user: ContactUser): Promise<OAuthLoginResponse> {
    const code = generateNumericCode();
    const ttlSec = Number(process.env['CONTACT_CODE_TTL_SEC'] ?? 300);
    const expiresAt = new Date(Date.now() + ttlSec * 1000);

    await this.contactVerificationRepository.upsertCode(user.id, code, expiresAt);
    await this.codeMailer.sendCode(user.email, code);
    await this.recordVerificationSent(user);

    const verificationTicket = this.tokenService.issueContactTicket({
      sub: user.id,
      email: user.email,
    });
    return create(OAuthLoginResponseSchema, {
      verificationRequired: true,
      verificationTicket,
      contactToVerify: user.email,
    });
  }

  /** Подтверждение кода: на успехе завершает вход (токены), иначе — учёт попытки/провала. */
  async confirmContact(request: ConfirmContactRequest): Promise<ConfirmContactResponse> {
    let ticket: { sub: string; email: string };
    try {
      ticket = this.tokenService.verifyContactTicket(request.ticket);
    } catch {
      await this.recordConfirmationFailed('invalid_ticket');
      throw new ConnectError('invalid or expired ticket', Code.Unauthenticated);
    }

    const user = await this.authRepository.findById(ticket.sub);
    const record = await this.contactVerificationRepository.findByUserId(ticket.sub);
    if (!user || !record) {
      await this.recordConfirmationFailed('not_found', user ?? undefined);
      throw new ConnectError('verification not found', Code.NotFound);
    }

    // Уже подтверждён → просто завершаем вход (идемпотентно).
    if (record.confirmedAt) {
      return create(ConfirmContactResponseSchema, { result: await this.buildAuthResult(user) });
    }

    const maxAttempts = Number(process.env['CONTACT_CODE_MAX_ATTEMPTS'] ?? 5);
    if (record.attempts >= maxAttempts) {
      await this.recordConfirmationFailed('attempts_exceeded', user);
      throw new ConnectError('too many attempts, request a new code', Code.ResourceExhausted);
    }
    if (record.expiresAt < new Date()) {
      await this.recordConfirmationFailed('expired', user);
      throw new ConnectError('code expired, request a new one', Code.DeadlineExceeded);
    }
    if (!this.contactVerificationRepository.matches(record, request.code)) {
      await this.contactVerificationRepository.incrementAttempts(user.id);
      await this.recordConfirmationFailed('invalid_code', user);
      throw new ConnectError('invalid code', Code.InvalidArgument);
    }

    await this.contactVerificationRepository.markConfirmed(user.id);
    await this.recordConfirmed(user);
    await this.notifyContactConfirmed(user);
    return create(ConfirmContactResponseSchema, { result: await this.buildAuthResult(user) });
  }

  /** Повторная отправка кода с серверным кулдауном против перебора. */
  async resendContactCode(request: ResendContactCodeRequest): Promise<ResendContactCodeResponse> {
    let ticket: { sub: string; email: string };
    try {
      ticket = this.tokenService.verifyContactTicket(request.ticket);
    } catch {
      await this.recordConfirmationFailed('invalid_ticket');
      throw new ConnectError('invalid or expired ticket', Code.Unauthenticated);
    }

    const user = await this.authRepository.findById(ticket.sub);
    const record = await this.contactVerificationRepository.findByUserId(ticket.sub);
    if (!user || !record) {
      await this.recordConfirmationFailed('not_found', user ?? undefined);
      throw new ConnectError('verification not found', Code.NotFound);
    }
    if (record.confirmedAt) {
      return create(ResendContactCodeResponseSchema, {});
    }

    // Серверный кулдаун: нельзя выпускать новый код чаще, чем раз в N секунд.
    const cooldownSec = Number(process.env['CONTACT_CODE_RESEND_COOLDOWN_SEC'] ?? 60);
    if (Date.now() - record.lastSentAt.getTime() < cooldownSec * 1000) {
      await this.recordConfirmationFailed('resend_too_soon', user);
      throw new ConnectError('please wait before requesting a new code', Code.ResourceExhausted);
    }

    const code = generateNumericCode();
    const ttlSec = Number(process.env['CONTACT_CODE_TTL_SEC'] ?? 300);
    await this.contactVerificationRepository.upsertCode(
      user.id,
      code,
      new Date(Date.now() + ttlSec * 1000),
    );
    await this.codeMailer.sendCode(user.email, code);
    await this.recordVerificationSent(user);
    return create(ResendContactCodeResponseSchema, {});
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
    return create(OAuthLoginResponseSchema, { result: await this.buildAuthResult(record) });
  }

  /** Создаёт нашу JWT-пару + сохраняет refresh; возвращает AuthResult. */
  private async buildAuthResult(record: OAuthUserRecord): Promise<AuthResult> {
    const rpcUser = this.authRepository.toMessage(record);
    const { accessToken, refreshToken, refreshExpiresAt } = this.tokenService.generateTokenPair({
      sub: rpcUser.id,
      email: rpcUser.email,
      role: rpcUser.role.toString(),
    });

    await this.refreshTokenRepository.save(rpcUser.id, refreshToken, refreshExpiresAt);

    return create(AuthResultSchema, { accessToken, refreshToken, user: rpcUser });
  }

  private async notifyContactConfirmed(user: ContactUser): Promise<void> {
    await this.notificationService.createInternalNotification({
      userId: user.id,
      title: 'Контакт подтверждён',
      message: 'Ваш контакт подтверждён, аккаунт активирован.',
      category: RpcNotificationCategory.SYSTEM,
      type: RpcNotificationType.IN_APP,
    });
  }

  private async recordVerificationSent(user: ContactUser): Promise<void> {
    await this.auditService.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorName: user.fullName,
      actorRole: user.role,
      eventType: CONTACT_VERIFICATION_SENT_EVENT,
      targetType: 'User',
      targetId: user.id,
      actionTitle: 'Отправлен код подтверждения контакта',
      actionContext: 'Код отправлен на email пользователя',
      targetTitle: user.fullName || user.email,
      targetContext: user.email,
      after: authDetails({ outcome: 'sent', email: user.email }),
    });
  }

  private async recordConfirmed(user: ContactUser): Promise<void> {
    await this.auditService.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorName: user.fullName,
      actorRole: user.role,
      eventType: CONTACT_CONFIRMED_EVENT,
      targetType: 'User',
      targetId: user.id,
      actionTitle: 'Контакт подтверждён',
      actionContext: 'Пользователь подтвердил контакт кодом',
      targetTitle: user.fullName || user.email,
      targetContext: user.email,
      after: authDetails({ outcome: 'succeeded', email: user.email }),
    });
  }

  private async recordConfirmationFailed(reason: string, user?: ContactUser): Promise<void> {
    await this.auditService.record({
      actorUserId: user?.id,
      actorEmail: user?.email,
      actorName: user?.fullName,
      actorRole: user?.role,
      allowAnonymous: true,
      eventType: CONTACT_CONFIRMATION_FAILED_EVENT,
      targetType: user ? 'User' : 'Security',
      targetId: user?.id ?? null,
      actionTitle: 'Неудачное подтверждение контакта',
      actionContext: reasonLabel(reason),
      targetTitle: user?.fullName || user?.email || 'Contact verification attempt',
      targetContext: user?.email,
      after: authDetails({ outcome: 'failed', reason, email: user?.email }),
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
    case 'invalid_ticket':
      return 'Невалидный или просроченный ticket подтверждения';
    case 'not_found':
      return 'Запись подтверждения не найдена';
    case 'attempts_exceeded':
      return 'Превышено число попыток ввода кода';
    case 'expired':
      return 'Код подтверждения истёк';
    case 'invalid_code':
      return 'Неверный код подтверждения';
    case 'resend_too_soon':
      return 'Слишком частый запрос нового кода';
    default:
      return reason;
  }
}

/** 6-значный код подтверждения, криптослучайный. */
function generateNumericCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
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
