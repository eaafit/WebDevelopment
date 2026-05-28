import { Injectable } from '@nestjs/common';
import { OrderService } from './order.service';
import { ListOrdersRequest, GetOrderRequest } from '@notary-portal/api-contracts';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';

@Injectable()
export class OrderRpcService {
  constructor(private readonly orderService: OrderService) {}

  async listOrders(request: ListOrdersRequest): Promise<any> {
    // Преобразуем Timestamp (из запроса) → Date для сервиса базы данных
    const findManyParams = {
      userId: request.userId,
      role: request.role as 'applicant' | 'notary' | undefined,
      status: request.status,
      searchQuery: request.searchQuery,
      dateFrom: request.dateFrom ? timestampDate(request.dateFrom) : undefined,
      dateTo: request.dateTo ? timestampDate(request.dateTo) : undefined,
      page: request.page,
      pageSize: request.pageSize,
    };
    const result = await this.orderService.findMany(findManyParams);
    return {
      orders: result.orders.map((order: any) => this.toOrderProto(order)),
      totalCount: result.total,
      totalPages: result.totalPages,
    };
  }

  async getOrder(request: GetOrderRequest): Promise<any> {
    const order = await this.orderService.findOne(request.orderId);
    return this.toOrderProto(order);
  }

  private toOrderProto(order: any): any {
    // Преобразуем Date (из базы) → Timestamp для RPC-ответа
    return {
      id: order.id,
      objectAddress: order.objectAddress,
      orderDate: order.orderDate ? timestampFromDate(order.orderDate) : undefined,
      status: order.status,
      totalAmount: order.totalAmount,
      statusHistory: order.statusHistory?.map((h: any) => ({
        status: h.status,
        date: h.date ? timestampFromDate(h.date) : undefined,
        comment: h.comment,
      })) || [],
      applicantId: order.applicantId,
      applicantName: order.applicantName,
      notaryId: order.notaryId,
      notaryName: order.notaryName,
      plannedCompletionDate: order.plannedCompletionDate ? timestampFromDate(order.plannedCompletionDate) : undefined,
      actualCompletionDate: order.actualCompletionDate ? timestampFromDate(order.actualCompletionDate) : undefined,
      transactionId: order.transactionId,
      realEstateObject: order.realEstateObject,
    };
  }
}