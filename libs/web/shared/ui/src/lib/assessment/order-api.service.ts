import { Injectable, inject } from '@angular/core';
import { createClient } from '@connectrpc/connect';
import { OrderService, Order } from '@notary-portal/api-contracts';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { RPC_TRANSPORT } from '@notary-portal/ui';

export interface ListOrdersResponse {
  orders: Order[];
  totalCount: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class OrderApiService {
  private readonly client = createClient(OrderService, inject(RPC_TRANSPORT));

  async listOrders(params: {
    userId: string;
    role: string;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    pageSize: number;
  }): Promise<ListOrdersResponse> {
    const response = await this.client.listOrders({
      userId: params.userId,
      role: params.role,
      status: params.status,
      searchQuery: params.search,
      dateFrom: params.dateFrom ? timestampFromDate(new Date(params.dateFrom)) : undefined,
      dateTo: params.dateTo ? timestampFromDate(new Date(params.dateTo)) : undefined,
      page: params.page,
      pageSize: params.pageSize,
    });
    return {
      orders: response.orders,
      totalCount: response.totalCount,
      totalPages: response.totalPages,
    };
  }

  async getOrder(id: string): Promise<Order> {
    return await this.client.getOrder({ orderId: id });
  }

  async takeOrder(orderId: string, notaryId: string): Promise<Order> {
    const response = await this.client.takeOrder({ orderId, notaryId });
    if (!response.order) {
      throw new Error('Server did not return order data');
    }
    return response.order;
  }
}