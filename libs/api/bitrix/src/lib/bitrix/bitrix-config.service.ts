import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { BitrixConfig } from '@notary-portal/api-contracts';

@Injectable()
export class BitrixConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(): Promise<BitrixConfig> {
    const config = await this.prisma.bitrixConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      return this.getDefaultConfig();
    }

    return {
      portal_url: config.portalUrl,
      member_id: config.memberId,
      access_token: config.accessToken,
      is_active: config.isActive,
      created_at: config.createdAt,
      updated_at: config.updatedAt,
    };
  }

  async updateConfig(data: {
    portalUrl: string;
    memberId: string;
    accessToken: string;
    isActive: boolean;
  }): Promise<BitrixConfig> {
    const existing = await this.prisma.bitrixConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    if (existing) {
      const updated = await this.prisma.bitrixConfig.update({
        where: { id: existing.id },
        data: {
          portalUrl: data.portalUrl,
          memberId: data.memberId,
          accessToken: data.accessToken,
          isActive: data.isActive,
          updatedAt: now,
        },
      });

      return {
        portal_url: updated.portalUrl,
        member_id: updated.memberId,
        access_token: updated.accessToken,
        is_active: updated.isActive,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
      };
    } else {
      const created = await this.prisma.bitrixConfig.create({
        data: {
          portalUrl: data.portalUrl,
          memberId: data.memberId,
          accessToken: data.accessToken,
          isActive: data.isActive,
          createdAt: now,
          updatedAt: now,
        },
      });

      return {
        portal_url: created.portalUrl,
        member_id: created.memberId,
        access_token: created.accessToken,
        is_active: created.isActive,
        created_at: created.createdAt,
        updated_at: created.updatedAt,
      };
    }
  }

  async getActiveConfig(): Promise<{ portalUrl: string; memberId: string; accessToken: string } | null> {
    const config = await this.prisma.bitrixConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      return null;
    }

    return {
      portalUrl: config.portalUrl,
      memberId: config.memberId,
      accessToken: config.accessToken,
    };
  }

  private getDefaultConfig(): BitrixConfig {
    const now = new Date();
    return {
      portal_url: '',
      member_id: '',
      access_token: '',
      is_active: false,
      created_at: now,
      updated_at: now,
    };
  }
}
