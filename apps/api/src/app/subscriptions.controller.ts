import { PrismaService, SubscriptionPlan } from '@internal/prisma';
import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';

export type AdminSubscriptionRow = {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: 'Active' | 'Expired' | 'Cancelled';
};

@Controller('api/subscriptions')
export class SubscriptionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('plan') plan?: SubscriptionPlan,
    @Query('status') status?: 'active' | 'expired' | 'cancelled',
  ): Promise<AdminSubscriptionRow[]> {
    // TODO: add auth/role guard for admin-only access
    const now = new Date();
    const where: any = {};
    if (plan) where.plan = plan;
    if (status === 'active') where.isActive = true;
    if (status === 'cancelled') where.isActive = false;

    const rows = await this.prisma.subscription.findMany({
      where,
      orderBy: { startDate: 'desc' },
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      select: {
        id: true,
        userId: true,
        plan: true,
        startDate: true,
        endDate: true,
        isActive: true,
      },
    });

    return rows
      .map((r) => {
        const expired = r.endDate.getTime() < now.getTime();
        const computedStatus: AdminSubscriptionRow['status'] = !r.isActive
          ? 'Cancelled'
          : expired
            ? 'Expired'
            : 'Active';
        return {
          id: r.id,
          userId: r.userId,
          plan: r.plan,
          startDate: r.startDate.toISOString(),
          endDate: r.endDate.toISOString(),
          isActive: r.isActive,
          status: computedStatus,
        };
      })
      .filter((r) => {
        if (!status) return true;
        if (status === 'active') return r.status === 'Active';
        if (status === 'expired') return r.status === 'Expired';
        return r.status === 'Cancelled';
      });
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Body() _body: unknown): Promise<AdminSubscriptionRow> {
    // TODO: add auth/role guard for admin-only access
    const updated = await this.prisma.subscription.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        userId: true,
        plan: true,
        startDate: true,
        endDate: true,
        isActive: true,
      },
    });

    const now = new Date();
    const expired = updated.endDate.getTime() < now.getTime();
    const computedStatus: AdminSubscriptionRow['status'] = !updated.isActive
      ? 'Cancelled'
      : expired
        ? 'Expired'
        : 'Active';

    return {
      id: updated.id,
      userId: updated.userId,
      plan: updated.plan,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate.toISOString(),
      isActive: updated.isActive,
      status: computedStatus,
    };
  }
}

