import { Module } from '@nestjs/common';
import { PrismaModule } from '@internal/prisma';
import { AuditModule } from '@internal/audit';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';
import { NotificationRpcService } from './notification-rpc.service';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [NotificationRepository, NotificationService, NotificationRpcService],
  exports: [NotificationService, NotificationRpcService],
})
export class NotificationModule {}
