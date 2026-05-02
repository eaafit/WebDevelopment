import { Module } from '@nestjs/common';
import { PrismaModule } from '@internal/prisma';
import { NewsletterRepository } from './newsletter.repository';
import { NewsletterRpcService } from './newsletter-rpc.service';
import { NewsletterService } from './newsletter.service';

@Module({
  imports: [PrismaModule],
  providers: [NewsletterRepository, NewsletterService, NewsletterRpcService],
  exports: [NewsletterRpcService],
})
export class NewsletterModule {}
