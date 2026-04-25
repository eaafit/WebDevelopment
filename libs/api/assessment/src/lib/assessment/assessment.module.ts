import { Module } from '@nestjs/common';
import { AuditModule } from '@internal/audit';
import { PrismaModule } from '@internal/prisma';
import { AssessmentRepository } from './assessment.repository';
import { AssessmentService } from './assessment.service';
import { AssessmentRpcService } from './assessment-rpc.service';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [AssessmentRepository, AssessmentService, AssessmentRpcService],
  exports: [AssessmentRpcService],
})
export class AssessmentModule {}
