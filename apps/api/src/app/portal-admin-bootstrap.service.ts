import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PasswordService } from '@internal/auth';
import { PrismaService } from '@internal/prisma';
import { Role } from '@internal/prisma-client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

const ENV_EMAIL = 'PORTAL_BOOTSTRAP_ADMIN_EMAIL';
const ENV_PASSWORD = 'PORTAL_BOOTSTRAP_ADMIN_PASSWORD';
const ENV_FULL_NAME = 'PORTAL_BOOTSTRAP_ADMIN_FULL_NAME';

/**
 * Creates or promotes the portal admin user from environment variables (no prisma seed).
 * Set {@link ENV_EMAIL} and {@link ENV_PASSWORD} in `.env.portal` (or process env).
 */
@Injectable()
export class PortalAdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(PortalAdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async onModuleInit(): Promise<void> {
    const rawEmail = process.env[ENV_EMAIL]?.trim();
    const password = process.env[ENV_PASSWORD];

    if (!rawEmail || !password) {
      return;
    }

    const email = rawEmail.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      this.logger.warn(`${ENV_EMAIL} is set but invalid; skipping portal admin bootstrap`);
      return;
    }

    if (password.length < MIN_PASSWORD_LEN) {
      this.logger.warn(
        `${ENV_PASSWORD} is too short (min ${MIN_PASSWORD_LEN}); skipping portal admin bootstrap`,
      );
      return;
    }

    const fullName = process.env[ENV_FULL_NAME]?.trim() || 'Administrator';

    try {
      const existing = await this.prisma.user.findUnique({ where: { email } });

      if (existing) {
        if (existing.role === Role.Admin) {
          this.logger.log(`Portal admin already exists (${email}); bootstrap skipped`);
          return;
        }

        const passwordHash = await this.passwordService.hash(password);
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { role: Role.Admin, passwordHash, fullName },
        });
        this.logger.log(`User ${email} promoted to Admin and password updated from bootstrap env`);
        return;
      }

      const passwordHash = await this.passwordService.hash(password);
      await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          role: Role.Admin,
        },
      });
      this.logger.log(`Portal admin user created from ${ENV_EMAIL}`);
    } catch (error) {
      // Fresh DB before `prisma migrate deploy`: schema missing — do not block API startup.
      if (isPrismaMissingTable(error)) {
        this.logger.warn(
          `Portal admin bootstrap skipped: schema not ready (run migrate profile, then restart). ${ENV_EMAIL} is set.`,
        );
        return;
      }

      this.logger.error(
        'Portal admin bootstrap failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}

function isPrismaMissingTable(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2021'
  );
}
