import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@internal/prisma';

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Сохранение нового refresh-токена ───────────────────────────────────
  // Используем SHA-256 для хранения (в отличие от bcrypt — быстрый lookup,
  // т.к. refresh-токен уже 48 крипто-случайных байт и предугадать нельзя)

  async save(userId: string, rawToken: string, expiresAt: Date): Promise<void> {
    const tokenHash = this.hash(rawToken);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  // ─── Поиск и валидация ───────────────────────────────────────────────────

  async findValid(rawToken: string) {
    const tokenHash = this.hash(rawToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) return null;
    if (record.revokedAt) return null;
    if (record.expiresAt < new Date()) return null;

    return record;
  }

  // ─── Отзыв одного токена (logout) ────────────────────────────────────────

  async revoke(rawToken: string): Promise<boolean> {
    const tokenHash = this.hash(rawToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt) return false;

    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data:  { revokedAt: new Date() },
    });
    return true;
  }

  // ─── Отзыв всех токенов пользователя (сброс сессий) ─────────────────────

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
  }

  // ─── Ротация: отозвать старый, вернуть userId для выпуска нового ─────────

  async rotate(rawToken: string): Promise<string | null> {
    const record = await this.findValid(rawToken);
    if (!record) return null;

    await this.revoke(rawToken);
    return record.userId;
  }

  // ─── SHA-256 hash helper ─────────────────────────────────────────────────

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
