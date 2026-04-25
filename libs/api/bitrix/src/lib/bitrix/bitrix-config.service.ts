import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { BitrixConfigSchema, type BitrixConfig } from '@notary-portal/api-contracts';

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

    return create(BitrixConfigSchema, {
      portalUrl: config.portalUrl,
      memberId: config.memberId,
      accessToken: config.accessToken,
      isActive: config.isActive,
      createdAt: timestampFromDate(config.createdAt),
      updatedAt: timestampFromDate(config.updatedAt),
    });
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

      return create(BitrixConfigSchema, {
        portalUrl: updated.portalUrl,
        memberId: updated.memberId,
        accessToken: updated.accessToken,
        isActive: updated.isActive,
        createdAt: timestampFromDate(updated.createdAt),
        updatedAt: timestampFromDate(updated.updatedAt),
      });
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

      return create(BitrixConfigSchema, {
        portalUrl: created.portalUrl,
        memberId: created.memberId,
        accessToken: created.accessToken,
        isActive: created.isActive,
        createdAt: timestampFromDate(created.createdAt),
        updatedAt: timestampFromDate(created.updatedAt),
      });
    }
  }

  async getActiveConfig(): Promise<{
    portalUrl: string;
    memberId: string;
    accessToken: string;
  } | null> {
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
    return create(BitrixConfigSchema, {
      portalUrl: '',
      memberId: '',
      accessToken: '',
      isActive: false,
      createdAt: timestampFromDate(now),
      updatedAt: timestampFromDate(now),
    });
  }
}
