import { Module } from '@nestjs/common';
import { BitrixRpcService } from './bitrix-rpc.service';
import { BitrixConfigService } from './bitrix-config.service';
import { BitrixApiService } from './bitrix-api.service';
import { BitrixSyncService } from './bitrix-sync.service';
import { PrismaModule } from '@internal/prisma';

@Module({
  imports: [PrismaModule],
  providers: [BitrixRpcService, BitrixConfigService, BitrixApiService, BitrixSyncService],
  exports: [BitrixRpcService, BitrixConfigService, BitrixApiService, BitrixSyncService],
})
export class BitrixModule {}
