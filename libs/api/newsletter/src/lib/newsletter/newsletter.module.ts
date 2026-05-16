import { Module } from '@nestjs/common';
import { AuditModule } from '@internal/audit';
import { PrismaModule } from '@internal/prisma';
import { NotificationModule } from '@internal/notification';
import { NewsletterRepository } from './newsletter.repository';
import { NewsletterRpcService } from './newsletter-rpc.service';
import { NewsletterService } from './newsletter.service';

@Module({
  imports: [PrismaModule, AuditModule, NotificationModule],
  providers: [NewsletterRepository, NewsletterService, NewsletterRpcService],
  exports: [NewsletterRpcService],
})
export class NewsletterModule {}
