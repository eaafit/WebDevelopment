import { Module } from '@nestjs/common';
import { PrismaModule } from '@internal/prisma';
import { AuditRepository } from './audit.repository';
import { AuditRpcService } from './audit-rpc.service';
import { AuditService } from './audit.service';

@Module({
  imports: [PrismaModule],
  providers: [AuditRepository, AuditService, AuditRpcService],
  exports: [AuditService, AuditRpcService],
})
export class AuditModule {}
