import { Module } from '@nestjs/common';
import { PrismaModule } from '@internal/prisma';
import { SupportRpcService } from './support-rpc.service';
import { SupportService } from './support.service';

@Module({
  imports: [PrismaModule],
  providers: [SupportService, SupportRpcService],
  exports: [SupportService, SupportRpcService],
})
export class SupportModule {}
