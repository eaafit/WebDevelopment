import { Module } from '@nestjs/common';
import { AuditModule } from '@internal/audit';
import { NotificationModule } from '@internal/notification';
import { PrismaModule } from '@internal/prisma';
import { AssessmentRepository } from './assessment.repository';
import { AssessmentService } from './assessment.service';
import { AssessmentRpcService } from './assessment-rpc.service';

@Module({
  imports: [PrismaModule, AuditModule, NotificationModule],
  providers: [AssessmentRepository, AssessmentService, AssessmentRpcService],
  exports: [AssessmentRpcService],
})
export class AssessmentModule {}
