import { Module } from '@nestjs/common';
import { AssessmentModule } from '@internal/assessment';
import { AuthModule } from '@internal/auth';
import { BillingModule } from '@internal/billing';
import { DocumentModule } from '@internal/document';
import { MetricsModule } from '@internal/metrics';
import { NotificationModule } from '@internal/notification';
import { ReportModule } from '@internal/report';
import { UserModule } from '@internal/user';
import { PrismaModule } from '@internal/prisma';
import { ConnectRouterRegistry } from './connect-router.registry';
import { MailModule } from './mail.module';
import { PaymentAttachmentController } from './payment-attachment.controller';

@Module({
  imports: [
    PrismaModule,
    MetricsModule,
    MailModule,
    AuthModule,
    AssessmentModule,
    BillingModule,
    DocumentModule,
    NotificationModule,
    ReportModule,
    UserModule,
  ],
  controllers: [PaymentAttachmentController],
  providers: [ConnectRouterRegistry],
})
export class AppModule {}
