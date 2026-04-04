import { Module } from '@nestjs/common';
import { AssessmentModule } from '@internal/assessment';
import { AuthModule } from '@internal/auth';
import { BillingModule } from '@internal/billing';
import { DocumentModule } from '@internal/document';
import { MetricsModule } from '@internal/metrics';
import { NotificationModule } from '@internal/notification';
import { ReportModule } from '@internal/report';
import { SupportModule } from '@internal/support';
import { UserModule } from '@internal/user';
import { PrismaModule } from '@internal/prisma';
import { ConnectRouterRegistry } from './connect-router.registry';

@Module({
  imports: [
    PrismaModule,
    MetricsModule,
    AuthModule,
    AssessmentModule,
    BillingModule,
    DocumentModule,
    NotificationModule,
    ReportModule,
    SupportModule,
    UserModule,
  ],
  providers: [ConnectRouterRegistry],
})
export class AppModule {}
