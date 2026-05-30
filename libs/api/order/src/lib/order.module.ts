import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderRpcService } from './order-rpc.service';
import { PrismaModule } from '@internal/prisma';

@Module({
  imports: [PrismaModule],
  controllers: [OrderController],
  providers: [OrderService, OrderRpcService],
  exports: [OrderService, OrderRpcService],
})
export class OrderModule {}