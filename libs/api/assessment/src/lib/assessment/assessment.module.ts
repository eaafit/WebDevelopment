import { AuthModule } from '@internal/auth';
import { AssessmentWorkspaceService } from './assessment-workspace.service';
import { AssessmentWorkspaceController } from './assessment-workspace.controller';
import { Module } from '@nestjs/common';
import { AuditModule } from '@internal/audit';
import { BitrixLeadsModule } from '@internal/bitrix-leads';
import { NotificationModule } from '@internal/notification';
import { PrismaModule } from '@internal/prisma';
import { AssessmentRepository } from './assessment.repository';
import { AssessmentService } from './assessment.service';
import { AssessmentRpcService } from './assessment-rpc.service';
import { fiasProviderFactory } from '../fias/fias-provider.factory';
import { OrderModule } from '@notary-portal/order';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    AuditModule,
    NotificationModule,
    BitrixLeadsModule,
    OrderModule,
  ],
  controllers: [AssessmentWorkspaceController],
  providers: [
    AssessmentWorkspaceService,
    AssessmentRepository,
    AssessmentService,
    AssessmentRpcService,
    fiasProviderFactory,
  ],
  exports: [AssessmentRpcService],
})
export class AssessmentModule {}
