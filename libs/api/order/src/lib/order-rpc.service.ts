import { Injectable } from '@nestjs/common';
import { OrderService } from './order.service';

@Injectable()
export class OrderRpcService {
  constructor(private orderService: OrderService) {}

  async listOrders(request: any): Promise<any> {
    const { orders, total, totalPages } = await this.orderService.findMany(request);
    return { orders, totalCount: total, totalPages };
  }

  async getOrder(request: { orderId: string }): Promise<any> {
    return await this.orderService.findOne(request.orderId);
  }
}