import { Module } from '@nestjs/common';
import { PrismaModule } from '@internal/prisma';
import { ReportRepository } from './report.repository';
import { ReportService } from './report.service';
import { ReportRpcService } from './report-rpc.service';

@Module({
  imports: [PrismaModule],
  providers: [ReportRepository, ReportService, ReportRpcService],
  exports: [ReportRpcService],
})
export class ReportModule {}
