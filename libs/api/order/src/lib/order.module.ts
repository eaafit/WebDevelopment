import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderRpcService } from './order-rpc.service';
import { PrismaModule } from '@internal/prisma';
import { BitrixOrdersModule } from '@notary-portal/bitrix-orders';
import { AuditModule } from '@internal/audit';
import { NotificationModule } from '@internal/notification';

@Module({
  imports: [PrismaModule, BitrixOrdersModule, AuditModule, NotificationModule],
  controllers: [OrderController],
  providers: [OrderService, OrderRpcService],
  exports: [OrderService, OrderRpcService],
})
export class OrderModule {}