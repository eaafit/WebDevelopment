import { Injectable, Inject, Optional } from '@nestjs/common';
import { create } from '@bufbuild/protobuf';
import { ConnectError, Code } from '@connectrpc/connect';
import { PrismaService } from '@internal/prisma';
import { TokenService } from './token.service';
import { AuthRepository } from './auth.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import {
  OAuthProvider,
  UserRole as RpcUserRole,
  type OAuthInitRequest,
  type OAuthInitResponse,
  type OAuthCallbackRequest,
  type OAuthCallbackResponse,
  type AuthResult,
} from '@notary-portal/api-contracts';
import { OAuthInitResponseSchema, AuthResultSchema } from '@notary-portal/api-contracts';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl?: string;
  redirectUri: string;
  scopes: string[];
}

const OAUTH_PROVIDERS: Record<OAuthProvider, OAuthConfig | undefined> = {
  [OAuthProvider.UNSPECIFIED]: undefined,
  [OAuthProvider.VK]: process.env['OAUTH_VK_CLIENT_ID']
    ? {
      clientId: process.env['OAUTH_VK_CLIENT_ID'],
      clientSecret: process.env['OAUTH_VK_CLIENT_SECRET']!,
      authorizationUrl: 'https://oauth.vk.com/authorize',
      tokenUrl: 'https://oauth.vk.com/access_token',
      userinfoUrl: 'https://api.vk.com/method/users.get',
      redirectUri: process.env['OAUTH_VK_REDIRECT_URI'] || `${process.env['FRONTEND_URL'] || 'http://localhost:4200'}/auth/callback`,
      scopes: ['email'],
    }
    : undefined,
  [OAuthProvider.GOOGLE]: process.env['OAUTH_GOOGLE_CLIENT_ID']
    ? {
      clientId: process.env['OAUTH_GOOGLE_CLIENT_ID'],
      clientSecret: process.env['OAUTH_GOOGLE_CLIENT_SECRET']!,
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userinfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      redirectUri: process.env['OAUTH_GOOGLE_REDIRECT_URI'] || `${process.env['FRONTEND_URL'] || 'http://localhost:4200'}/auth/callback`,
      scopes: ['openid', 'email', 'profile'],
    }
    : undefined,
  [OAuthProvider.APPLE]: process.env['OAUTH_APPLE_CLIENT_ID']
    ? {
      clientId: process.env['OAUTH_APPLE_CLIENT_ID'], // Service ID
      clientSecret: process.env['OAUTH_APPLE_CLIENT_SECRET']!, // Private key JWT
      authorizationUrl: 'https://appleid.apple.com/auth/authorize',
      tokenUrl: 'https://appleid.apple.com/auth/token',
      redirectUri: process.env['OAUTH_APPLE_REDIRECT_URI'] || `${process.env['FRONTEND_URL'] || 'http://localhost:4200'}/auth/callback`,
      scopes: ['name', 'email'],
    }
    : undefined,
  [OAuthProvider.YANDEX]: process.env['OAUTH_YANDEX_CLIENT_ID']
    ? {
      clientId: process.env['OAUTH_YANDEX_CLIENT_ID'],
      clientSecret: process.env['OAUTH_YANDEX_CLIENT_SECRET']!,
      authorizationUrl: 'https://oauth.yandex.ru/authorize',
      tokenUrl: 'https://oauth.yandex.ru/token',
      userinfoUrl: 'https://login.yandex.ru/info',
      redirectUri: process.env['OAUTH_YANDEX_REDIRECT_URI'] || `${process.env['FRONTEND_URL'] || 'http://localhost:4200'}/auth/callback`,
      scopes: ['login:email', 'login:info'],
    }
    : undefined,
};

@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly authRepository: AuthRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async oauthInit(request: OAuthInitRequest): Promise<OAuthInitResponse> {
    const provider = request.provider;
    const config = OAUTH_PROVIDERS[provider];

    if (!config) {
      throw new ConnectError(
        `OAuth provider ${OAuthProvider[provider]} is not configured`,
        Code.Unavailable,
      );
    }

    // Генерируем state для CSRF защиты
    const state = request.state || this.tokenService.generatePasswordResetToken();

    // Строим URL авторизации
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state: state,
    });

    // Специфичные параметры для провайдеров
    if (provider === OAuthProvider.GOOGLE) {
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
    } else if (provider === OAuthProvider.APPLE) {
      params.set('response_mode', 'form_post');
    }

    const authorizationUrl = `${config.authorizationUrl}?${params.toString()}`;

    return create(OAuthInitResponseSchema, {
      authorizationUrl,
      state,
    });
  }

  async oauthCallback(request: OAuthCallbackRequest): Promise<OAuthCallbackResponse> {
    const provider = request.provider;
    const config = OAUTH_PROVIDERS[provider];

    if (!config) {
      throw new ConnectError(
        `OAuth provider ${OAuthProvider[provider]} is not configured`,
        Code.Unavailable,
      );
    }

    // Обмен code на token
    const tokenResponse = await this.exchangeCodeForToken(config, request.code);

    // Получаем данные пользователя от провайдера
    const providerUser = await this.fetchProviderUserinfo(config, tokenResponse.accessToken);

    // Проверяем существующую привязку
    const existingAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: this.toPrismaOAuthProvider(provider),
          providerUserId: providerUser.id,
        },
      },
      include: { user: true },
    });

    let userId: string;
    let role: RpcUserRole;

    if (existingAccount) {
      // Пользователь уже существует
      userId = existingAccount.userId;
      role = this.authRepository.fromPrismaRole(existingAccount.user.role);

      // Обновляем токены
      await this.prisma.oAuthAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken || null,
          tokenExpiresAt: tokenResponse.expiresAt || null,
        },
      });
    } else {
      // Проверяем по email (если есть)
      const existingUser = providerUser.email
        ? await this.authRepository.findByEmail(providerUser.email.toLowerCase())
        : null;

      if (existingUser) {
        // Привязываем к существующему пользователю
        userId = existingUser.id;
        role = this.authRepository.fromPrismaRole(existingUser.role);

        await this.prisma.oAuthAccount.create({
          data: {
            userId,
            provider: this.toPrismaOAuthProvider(provider),
            providerUserId: providerUser.id,
            email: providerUser.email,
            fullName: providerUser.fullName,
            avatarUrl: providerUser.avatarUrl,
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken || null,
            tokenExpiresAt: tokenResponse.expiresAt || null,
          },
        });
      } else {
        // Создаём нового пользователя
        const newUser = await this.prisma.user.create({
          data: {
            email: providerUser.email || `${providerUser.id}@${OAuthProvider[provider]}.local`,
            passwordHash: '', // Пустой пароль для OAuth пользователей
            fullName: providerUser.fullName || 'OAuth User',
            role: this.authRepository.toPrismaRole(request.role || RpcUserRole.APPLICANT),
            oauthAccounts: {
              create: {
                provider: this.toPrismaOAuthProvider(provider),
                providerUserId: providerUser.id,
                email: providerUser.email,
                fullName: providerUser.fullName,
                avatarUrl: providerUser.avatarUrl,
                accessToken: tokenResponse.accessToken,
                refreshToken: tokenResponse.refreshToken || null,
                tokenExpiresAt: tokenResponse.expiresAt || null,
              },
            },
          },
        });

        userId = newUser.id;
        role = this.authRepository.fromPrismaRole(newUser.role);
      }
    }

    // Генерируем JWT токены
    const userRecord = await this.authRepository.findById(userId);
    if (!userRecord || !userRecord.isActive) {
      throw new ConnectError('User not found or deactivated', Code.Unauthenticated);
    }

    const rpcUser = this.authRepository.toMessage(userRecord);
    const { accessToken, refreshToken, refreshExpiresAt } = this.tokenService.generateTokenPair({
      sub: rpcUser.id,
      email: rpcUser.email,
      role: rpcUser.role.toString(),
    });

    await this.refreshTokenRepository.save(userId, refreshToken, refreshExpiresAt);

    return create(OAuthCallbackResponseSchema, {
      result: create(AuthResultSchema, {
        accessToken,
        refreshToken,
        user: rpcUser,
      }),
    });
  }

  private async exchangeCodeForToken(
    config: OAuthConfig,
    code: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
      grant_type: 'authorization_code',
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ConnectError(`Failed to exchange code for token: ${errorText}`, Code.Internal);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  private async fetchProviderUserinfo(
    config: OAuthConfig,
    accessToken: string,
  ): Promise<{ id: string; email?: string; fullName?: string; avatarUrl?: string }> {
    if (!config.userinfoUrl) {
      // Для Apple и других без userinfo URL, возвращаем заглушку
      // Реальные данные будут получены из id_token или дополнительных запросов
      throw new ConnectError('Userinfo endpoint not available', Code.Unimplemented);
    }

    let url = config.userinfoUrl;
    let options: RequestInit = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };

    // VK требует особый формат запроса
    if (config.userinfoUrl.includes('vk.com')) {
      url = `${config.userinfoUrl}?access_token=${accessToken}&fields=photo_200`;
      options = {};
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new ConnectError(`Failed to fetch userinfo: ${errorText}`, Code.Internal);
    }

    const data = await response.json();

    // Парсим ответ в зависимости от провайдера
    if (config.userinfoUrl.includes('vk.com')) {
      const vkData = data.response?.[0];
      return {
        id: String(vkData?.id || ''),
        email: vkData?.email,
        fullName: `${vkData?.first_name || ''} ${vkData?.last_name || ''}`.trim(),
        avatarUrl: vkData?.photo_200,
      };
    } else if (config.userinfoUrl.includes('googleapis.com')) {
      return {
        id: data.id,
        email: data.email,
        fullName: data.name,
        avatarUrl: data.picture,
      };
    } else if (config.userinfoUrl.includes('yandex.ru')) {
      return {
        id: String(data.id || ''),
        email: data.default_email || data.email,
        fullName: data.display_name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        avatarUrl: data.avatar ? `https://avatars.yandex.net/get-yapic/${data.avatar}/islands-200` : undefined,
      };
    }

    return {
      id: data.sub || data.id,
      email: data.email,
      fullName: data.name,
      avatarUrl: data.picture || data.avatar_url,
    };
  }

  private toPrismaOAuthProvider(provider: OAuthProvider): any {
    const map: Record<OAuthProvider, string> = {
      [OAuthProvider.UNSPECIFIED]: 'unspecified',
      [OAuthProvider.VK]: 'vk',
      [OAuthProvider.GOOGLE]: 'google',
      [OAuthProvider.APPLE]: 'apple',
      [OAuthProvider.YANDEX]: 'yandex',
    };
    return map[provider];
  }
}
