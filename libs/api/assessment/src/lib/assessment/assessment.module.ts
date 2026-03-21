import { Module } from '@nestjs/common';
import { PrismaModule } from '@internal/prisma';
import { AssessmentRepository } from './assessment.repository';
import { AssessmentService } from './assessment.service';
import { AssessmentRpcService } from './assessment-rpc.service';

@Module({
  imports: [PrismaModule],
  providers: [AssessmentRepository, AssessmentService, AssessmentRpcService],
  exports: [AssessmentRpcService],
})
export class AssessmentModule {}
