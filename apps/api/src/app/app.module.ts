import { Module } from '@nestjs/common';
import { BillingModule } from '@internal/billing';
import { PrismaModule } from '@internal/prisma';
import { ConnectRouterRegistry } from './connect-router.registry';

@Module({
  imports: [PrismaModule, BillingModule],
  providers: [ConnectRouterRegistry],
})
export class AppModule {}
