import { Module } from '@nestjs/common';
import { TariffPlanController } from './tariff-plan.controller';
import { TariffPlanService } from './tariff-plan.service';
import { PrismaModule } from '@notary-portal/prisma';

@Module({
  imports: [PrismaModule],
  controllers: [TariffPlanController],
  providers: [TariffPlanService],
  exports: [TariffPlanService],
})
export class TariffPlanModule {}
