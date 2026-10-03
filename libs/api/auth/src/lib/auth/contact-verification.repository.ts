import { createHash, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';

/** Проекция записи подтверждения контакта, нужная сервису. */
export interface ContactVerificationRecord {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
  confirmedAt: Date | null;
}

/**
 * Доступ к таблице contact_verifications. Хранит SHA-256 ХЭШ кода (не сам код),
 * одна строка на пользователя (upsert). По образцу PasswordResetRepository.
 */
@Injectable()
export class ContactVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Выпускает/перевыпускает код: новый хэш, срок, attempts=0, lastSentAt=now, confirmedAt=null. */
  async upsertCode(userId: string, rawCode: string, expiresAt: Date): Promise<void> {
    const codeHash = this.hash(rawCode);
    const now = new Date();
    await this.prisma.contactVerification.upsert({
      where: { userId },
      create: { userId, codeHash, expiresAt, attempts: 0, lastSentAt: now },
      update: { codeHash, expiresAt, attempts: 0, lastSentAt: now, confirmedAt: null },
    });
  }

  async findByUserId(userId: string): Promise<ContactVerificationRecord | null> {
    return this.prisma.contactVerification.findUnique({ where: { userId } });
  }

  async incrementAttempts(userId: string): Promise<void> {
    await this.prisma.contactVerification.update({
      where: { userId },
      data: { attempts: { increment: 1 } },
    });
  }

  async markConfirmed(userId: string): Promise<void> {
    await this.prisma.contactVerification.update({
      where: { userId },
      data: { confirmedAt: new Date() },
    });
  }

  /** Сравнение введённого кода с хэшем (timing-safe). */
  matches(record: ContactVerificationRecord, rawCode: string): boolean {
    const actual = Buffer.from(this.hash(rawCode));
    const expected = Buffer.from(record.codeHash);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
