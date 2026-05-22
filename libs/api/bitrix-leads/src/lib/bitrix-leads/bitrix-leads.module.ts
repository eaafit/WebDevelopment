import { Module } from '@nestjs/common';
import { BitrixLeadsConfigService } from './bitrix-leads-config.service';

@Module({
  providers: [BitrixLeadsConfigService],
  exports: [BitrixLeadsConfigService],
})
export class BitrixLeadsModule {}
