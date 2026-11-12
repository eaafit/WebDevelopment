import { Module } from '@nestjs/common';
import { PrismaModule } from '@internal/prisma';
import { SupportAiService } from './support-ai.service';
import { SupportRpcService } from './support-rpc.service';
import { SupportService } from './support.service';

@Module({
  imports: [PrismaModule],
  providers: [SupportAiService, SupportService, SupportRpcService],
  exports: [SupportService, SupportRpcService],
})
export class SupportModule {}
