import { Module } from '@nestjs/common';
import { SupportAiService } from './support-ai.service';
import { SupportRpcService } from './support-rpc.service';

@Module({
  providers: [SupportAiService, SupportRpcService],
  exports: [SupportRpcService],
})
export class SupportModule {}
