import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderRpcService } from './order-rpc.service';
import { PrismaModule } from '@internal/prisma';
import { BitrixOrdersModule } from '@notary-portal/bitrix-orders';

@Module({
  imports: [PrismaModule, BitrixOrdersModule],
  controllers: [OrderController],
  providers: [OrderService, OrderRpcService],
  exports: [OrderService, OrderRpcService],
})
export class OrderModule {}