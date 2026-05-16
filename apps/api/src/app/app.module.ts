import { Module } from '@nestjs/common';
import { TariffPlanModule } from '@internal/api/tariff-plan';
import { DiscountModule } from '@internal/api/discount';
import { PromocodeModule } from '@internal/api/promocode';
import { AuditModule } from '@internal/audit';
import { AssessmentModule } from '@internal/assessment';
import { AuthModule } from '@internal/auth';
import { BillingModule } from '@internal/billing';
import { BitrixModule } from '@internal/bitrix';
import { DocumentModule } from '@internal/document';
import { MetricsModule } from '@internal/metrics';
import { NewsletterModule } from '@internal/newsletter';
import { NotificationModule } from '@internal/notification';
import { ReportModule } from '@internal/report';
import { UserModule } from '@internal/user';
import { PrismaModule } from '@internal/prisma';
import { ConnectRouterRegistry } from './connect-router.registry';
import { LoggingModule } from './logging/logging.module';
import { MailModule } from './mail.module';
import { PaymentAttachmentController } from './payment-attachment.controller';
import { PortalAdminBootstrapService } from './portal-admin-bootstrap.service';
import { SubscriptionsController } from './subscriptions.controller';

@Module({
  imports: [
    LoggingModule,
    PrismaModule,
    TariffPlanModule,
    DiscountModule,
    PromocodeModule,
    MetricsModule,
    MailModule,
    AuthModule,
    AuditModule,
    AssessmentModule,
    BillingModule,
    BitrixModule,
    DocumentModule,
    NewsletterModule,
    NotificationModule,
    ReportModule,
    UserModule,
  ],
  controllers: [PaymentAttachmentController, SubscriptionsController],
  providers: [ConnectRouterRegistry, PortalAdminBootstrapService],
})
export class AppModule {}
