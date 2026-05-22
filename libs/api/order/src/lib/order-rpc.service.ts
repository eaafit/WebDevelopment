// import { Injectable } from '@nestjs/common';
// import { OrderService } from './order.service';
// // import { RpcException } from '@nestjs/microservices';
// import { PrismaModule } from '@internal/prisma';

// @Injectable()
// export class OrderRpcService {
//   constructor(private orderService: OrderService) {}

//   async listOrders(request: any): Promise<any> {
//     try {
//       const { orders, total, totalPages } = await this.orderService.findMany(request);
//       return { orders, totalCount: total, totalPages };
//     } catch (err) {
//       throw new Error(err.message);
//     }
//   }

//   async getOrder(request: { orderId: string }): Promise<any> {
//     try {
//       return await this.orderService.findOne(request.orderId);
//     } catch (err) {
//       throw new RpcException(err.message);
//     }
//   }
// }