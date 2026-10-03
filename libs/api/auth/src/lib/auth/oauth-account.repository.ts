import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { OAuthProvider, Role as PrismaRole } from '@internal/prisma-client';

/** Минимальная проекция пользователя, нужная OAuth-флоу. */
export interface OAuthUserRecord {
  id: string;
  email: string;
  fullName: string;
  role: PrismaRole;
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOAuthUserData {
  email: string;
  fullName: string;
  role: PrismaRole;
}

/**
 * Доступ к таблице oauth_accounts и создание пользователей без пароля.
 * Маппинг proto-provider → Prisma-enum делает вызывающий (OAuthService).
 */
@Injectable()
export class OAuthAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Пользователь по уже привязанному внешнему аккаунту, либо null. */
  async findUserByProviderAccount(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<OAuthUserRecord | null> {
    const account = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { user: true },
    });
    return account?.user ?? null;
  }

  /** Привязывает внешний аккаунт к существующему пользователю. */
  async linkAccount(
    userId: string,
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<void> {
    await this.prisma.oAuthAccount.create({
      data: { userId, provider, providerUserId },
    });
  }

  /** Создаёт нового пользователя (без пароля) сразу со связкой внешнего аккаунта. */
  async createUserWithAccount(
    data: CreateOAuthUserData,
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<OAuthUserRecord> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        role: data.role,
        passwordHash: null,
        oauthAccounts: { create: { provider, providerUserId } },
      },
    });
  }
}
