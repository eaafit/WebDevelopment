import { Module } from '@nestjs/common';
import { AuditModule } from '@internal/audit';
import { NotificationModule } from '@internal/notification';
import { PrismaModule } from '@internal/prisma';
import { AssessmentRepository } from './assessment.repository';
import { AssessmentService } from './assessment.service';
import { AssessmentRpcService } from './assessment-rpc.service';
import { fiasProviderFactory } from '../fias/fias-provider.factory';

@Module({
  imports: [PrismaModule, AuditModule, NotificationModule],
  providers: [AssessmentRepository, AssessmentService, AssessmentRpcService, fiasProviderFactory],
  exports: [AssessmentRpcService],
})
export class AssessmentModule {}
