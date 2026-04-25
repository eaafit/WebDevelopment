import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';

@Injectable()
export class PasswordResetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, rawToken: string, expiresAt: Date): Promise<void> {
    const tokenHash = this.hash(rawToken);
    await this.prisma.$transaction([
      this.prisma.passwordReset.deleteMany({
        where: { userId, usedAt: null },
      }),
      this.prisma.passwordReset.create({
        data: { userId, tokenHash, expiresAt },
      }),
    ]);
  }

  async findValid(rawToken: string) {
    const tokenHash = this.hash(rawToken);
    const record = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
    });
    if (!record) return null;
    if (record.usedAt) return null;
    if (record.expiresAt < new Date()) return null;
    return record;
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.passwordReset.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
