import { Module } from '@nestjs/common';
import { PrismaModule } from '@internal/prisma';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';
import { NotificationRpcService } from './notification-rpc.service';

@Module({
  imports: [PrismaModule],
  providers: [NotificationRepository, NotificationService, NotificationRpcService],
  exports: [NotificationService, NotificationRpcService],
})
export class NotificationModule {}
