import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PasswordService } from '@internal/auth';
import { PrismaService } from '@internal/prisma';
import { Role } from '@internal/prisma-client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

const ENV_EMAIL = 'PORTAL_BOOTSTRAP_ADMIN_EMAIL';
const ENV_PASSWORD = 'PORTAL_BOOTSTRAP_ADMIN_PASSWORD';
const ENV_FULL_NAME = 'PORTAL_BOOTSTRAP_ADMIN_FULL_NAME';
const ENV_SAMPLE_USERS = 'PORTAL_BOOTSTRAP_SAMPLE_USERS';
const ENV_SAMPLE_PASSWORD = 'SEED_USER_PASSWORD';

const SAMPLE_USERS: Array<{ email: string; fullName: string; role: Role }> = [
  { email: 'seed-user-000@seed.local', fullName: 'Seed Applicant', role: Role.Applicant },
  { email: 'seed-user-010@seed.local', fullName: 'Seed Notary', role: Role.Notary },
  { email: 'seed-user-020@seed.local', fullName: 'Seed Admin', role: Role.Admin },
];

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
    await this.bootstrapAdmin();
    await this.bootstrapSampleUsers();
  }

  private async bootstrapAdmin(): Promise<void> {
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

  private async bootstrapSampleUsers(): Promise<void> {
    if (!isEnabled(process.env[ENV_SAMPLE_USERS])) {
      return;
    }

    const password = process.env[ENV_SAMPLE_PASSWORD] ?? 'SeedPass123!';
    if (password.length < MIN_PASSWORD_LEN) {
      this.logger.warn(
        `${ENV_SAMPLE_PASSWORD} is too short (min ${MIN_PASSWORD_LEN}); skipping sample users bootstrap`,
      );
      return;
    }

    try {
      const passwordHash = await this.passwordService.hash(password);

      await Promise.all(
        SAMPLE_USERS.map((user) =>
          this.prisma.user.upsert({
            where: { email: user.email },
            update: {
              fullName: user.fullName,
              role: user.role,
              passwordHash,
              isActive: true,
            },
            create: {
              email: user.email,
              fullName: user.fullName,
              role: user.role,
              passwordHash,
              isActive: true,
            },
          }),
        ),
      );

      this.logger.log(`Sample auth users are ready (${SAMPLE_USERS.length})`);
    } catch (error) {
      if (isPrismaMissingTable(error)) {
        this.logger.warn(
          `Sample users bootstrap skipped: schema not ready (run migrate profile, then restart). ${ENV_SAMPLE_USERS} is enabled.`,
        );
        return;
      }

      this.logger.error(
        'Sample users bootstrap failed',
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

function isEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');
}
