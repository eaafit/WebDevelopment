import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
// import { OrderRpcService } from './order-rpc.service';
import { PrismaModule } from '@internal/prisma';

@Module({
  imports: [PrismaModule], // Импортируем модуль для работы с БД
  controllers: [OrderController],
  providers: [OrderService],
  exports: [], // Экспортируем RPC-сервис для других частей приложения
})
export class OrderModule {}