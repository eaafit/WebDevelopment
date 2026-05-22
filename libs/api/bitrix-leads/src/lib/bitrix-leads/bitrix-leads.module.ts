import { Module } from '@nestjs/common';
import axios from 'axios';

import { BitrixLeadsApiService } from './bitrix-leads-api.service';
import { BitrixLeadsConfigService } from './bitrix-leads-config.service';
import { BITRIX_LEADS_HTTP_CLIENT } from './bitrix-leads.tokens';

@Module({
  providers: [
    BitrixLeadsConfigService,
    BitrixLeadsApiService,
    {
      provide: BITRIX_LEADS_HTTP_CLIENT,
      useFactory: () =>
        axios.create({
          timeout: 10_000,
          headers: { 'Content-Type': 'application/json' },
        }),
    },
  ],
  exports: [BitrixLeadsConfigService, BitrixLeadsApiService],
})
export class BitrixLeadsModule {}
