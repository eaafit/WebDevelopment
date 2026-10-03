import { Module } from '@nestjs/common';
import { PrismaModule } from '@internal/prisma';
import axios from 'axios';

import { BitrixOrderPublisherService } from './bitrix-order-publisher.service';
import { BitrixOrdersApiService } from './bitrix-orders-api.service';
import { BitrixOrdersConfigService } from './bitrix-orders-config.service';
import { BITRIX_ORDERS_HTTP_CLIENT } from './bitrix-orders.tokens';

@Module({
  imports: [PrismaModule],
  providers: [
    BitrixOrdersConfigService,
    BitrixOrdersApiService,
    BitrixOrderPublisherService,
    {
      provide: BITRIX_ORDERS_HTTP_CLIENT,
      useFactory: () =>
        axios.create({
          timeout: 10_000,
          headers: { 'Content-Type': 'application/json' },
        }),
    },
  ],
  exports: [BitrixOrderPublisherService],
})
export class BitrixOrdersModule {}