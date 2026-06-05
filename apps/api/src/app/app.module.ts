import { Module } from '@nestjs/common';
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
import { SupportModule } from '@internal/support';
import { UserModule } from '@internal/user';
import { PrismaModule } from '@internal/prisma';
import { ConnectRouterRegistry } from './connect-router.registry';
import { LoggingModule } from './logging/logging.module';
import { MailModule } from './mail.module';
import { PaymentAttachmentController } from './payment-attachment.controller';
import { PortalAdminBootstrapService } from './portal-admin-bootstrap.service';
import { OrderModule } from '@notary-portal/order';
// import { OrderController } from './order.controller';

@Module({
  imports: [
    LoggingModule,
    PrismaModule,
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
    SupportModule,
    UserModule,
    OrderModule,
    // OrderController,
  ],
  controllers: [PaymentAttachmentController],
  providers: [ConnectRouterRegistry, PortalAdminBootstrapService],
})
export class AppModule {}
