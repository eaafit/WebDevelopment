import { PrismaService } from '@internal/prisma';
import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';

export type AdminPromoRow = {
  id: string;
  code: string;
  discountPercent: string;
  usageLimit: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  status: 'Active' | 'Expired' | 'Inactive';
};

@Controller('api/promos')
export class PromosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('filter') filter?: string,
    @Query('status') status?: 'active' | 'expired' | 'inactive',
  ): Promise<AdminPromoRow[]> {
    // TODO: add auth/role guard for admin-only access
    const now = new Date();
    const where: any = {};
    if (filter) where.code = { contains: filter, mode: 'insensitive' };

    const promos = await this.prisma.promo.findMany({
      where,
      orderBy: { usedCount: 'desc' },
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      select: {
        id: true,
        code: true,
        discountPercent: true,
        usageLimit: true,
        usedCount: true,
        expiresAt: true,
      },
    });

    const rows = promos.map((p) => {
      const isExpired = p.expiresAt ? p.expiresAt.getTime() < now.getTime() : false;
      const isDepleted = p.usageLimit != null ? p.usedCount >= p.usageLimit : false;
      const computedStatus: AdminPromoRow['status'] = isExpired
        ? 'Expired'
        : isDepleted
          ? 'Inactive'
          : 'Active';

      return {
        id: p.id,
        code: p.code,
        discountPercent: p.discountPercent.toString(),
        usageLimit: p.usageLimit ?? null,
        usedCount: p.usedCount,
        expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
        isActive: computedStatus === 'Active',
        status: computedStatus,
      };
    });

    if (!status) return rows;
    if (status === 'active') return rows.filter((r) => r.status === 'Active');
    if (status === 'expired') return rows.filter((r) => r.status === 'Expired');
    return rows.filter((r) => r.status === 'Inactive');
  }

  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string, @Body() _body: unknown): Promise<{ ok: true }> {
    // TODO: integrate real "isActive" field in DB for promos (currently derived from expiresAt)
    // For now this endpoint is a no-op so the admin UI can show feedback without breaking.
    await this.prisma.promo.findUnique({ where: { id } });
    return { ok: true };
  }
}

