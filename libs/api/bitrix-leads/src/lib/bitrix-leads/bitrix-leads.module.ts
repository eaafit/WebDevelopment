import { Module } from '@nestjs/common';
import { PrismaModule } from '@internal/prisma';
import axios from 'axios';

import { BitrixLeadPublisherService } from './bitrix-lead-publisher.service';
import { BitrixLeadsApiService } from './bitrix-leads-api.service';
import { BitrixLeadsConfigService } from './bitrix-leads-config.service';
import { BITRIX_LEADS_HTTP_CLIENT } from './bitrix-leads.tokens';

@Module({
  imports: [PrismaModule],
  providers: [
    BitrixLeadsConfigService,
    BitrixLeadsApiService,
    BitrixLeadPublisherService,
    {
      provide: BITRIX_LEADS_HTTP_CLIENT,
      useFactory: () =>
        axios.create({
          timeout: 10_000,
          headers: { 'Content-Type': 'application/json' },
        }),
    },
  ],
  exports: [
    BitrixLeadsConfigService,
    BitrixLeadsApiService,
    BitrixLeadPublisherService,
  ],
})
export class BitrixLeadsModule {}
