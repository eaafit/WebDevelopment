import { Injectable } from '@nestjs/common';
import { OrderService } from './order.service';
import { ListOrdersRequest, GetOrderRequest } from '@notary-portal/api-contracts';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { TakeOrderRequest, TakeOrderResponse, Order as OrderProto } from '@notary-portal/api-contracts';
import { GetRecentOrderEventsRequest } from '@notary-portal/api-contracts';

@Injectable()
export class OrderRpcService {
  constructor(private readonly orderService: OrderService) { }

  async listOrders(request: ListOrdersRequest): Promise<any> {
    try {
      // console.log('[OrderRpcService] listOrders called with:', JSON.stringify(request, null, 2));

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
      console.log('[OrderRpcService] findManyParams:', findManyParams);

      const result = await this.orderService.findMany(findManyParams);
      console.log('[OrderRpcService] findMany result:', {
        ordersCount: result.orders?.length,
        total: result.total,
        totalPages: result.totalPages,
      });

      const orders = result.orders.map((order: any) => {
        try {
          return this.toOrderProto(order);
        } catch (err) {
          console.error('[OrderRpcService] Error mapping order:', order?.id, err);
          throw err;
        }
      });

      console.log('[OrderRpcService] response orders count:', orders.length);
      if (orders.length > 0) {
        // Логируем первый заказ для проверки
        console.log('[OrderRpcService] First order sample:', JSON.stringify(orders[0], (key, value) => {
          if (typeof value === 'bigint') return value.toString();
          return value;
        }, 2));
      }

      const response = {
        orders: orders,
        totalCount: result.total,
        totalPages: result.totalPages,
      };
      return response;
    } catch (error) {
      console.error('[OrderRpcService] Error in listOrders:', error);
      throw error;
    }
  }

  async getOrder(request: GetOrderRequest): Promise<any> {
    try {
      const order = await this.orderService.findOne(request.orderId);
      return this.toOrderProto(order);
    } catch (error) {
      console.error('[OrderRpcService] Error in getOrder:', error);
      throw error;
    }
  }

  async takeOrder(request: TakeOrderRequest): Promise<any> {
    try {
      const order = await this.orderService.takeOrder(request.orderId, request.notaryId);
      return { order: this.toOrderProto(order) };   // важно: обёртка { order: ... }
    } catch (error) {
      console.error('[OrderRpcService] Error in takeOrder:', error);
      throw error;
    }
  }

  async getRecentOrderEvents(request: GetRecentOrderEventsRequest): Promise<any> {
    const events = await this.orderService.getRecentOrderEvents(
      request.userId,
      request.role,
      request.limit || 3,
    );
    // Преобразуем Date в Timestamp для каждого события для корретного отображения даты
    const mappedEvents = events.map(event => ({
      ...event,
      eventDate: event.eventDate ? timestampFromDate(event.eventDate) : undefined,
    }));
    return { events: mappedEvents };
  }

  private toOrderProto(order: any): any {
    // Безопасное преобразование Date → Timestamp
    const toTimestamp = (date: any) => {
      if (!date) return undefined;
      if (date instanceof Date) return timestampFromDate(date);
      if (typeof date === 'string') return timestampFromDate(new Date(date));
      if (typeof date === 'number') return timestampFromDate(new Date(date));
      if (date.seconds !== undefined) return date; // уже Timestamp
      console.warn('[OrderRpcService] Unexpected date value:', date, typeof date);
      return undefined;
    };

    // Преобразуем строку в число
    const totalAmountNum = order.totalAmount ? Number(order.totalAmount) : 0;

    // Заменяем null на undefined для optional полей
    const transactionIdVal = order.transactionId === null ? undefined : order.transactionId;

    const realEstateObject = order.realEstateObject
      ? {
        id: order.realEstateObject.id,
        address: order.realEstateObject.address,
        city: order.realEstateObject.city,
        area: order.realEstateObject.area ? Number(order.realEstateObject.area) : undefined,
        objectType: order.realEstateObject.objectType,
        roomsCount: order.realEstateObject.roomsCount ? Number(order.realEstateObject.roomsCount) : undefined,
        floor: order.realEstateObject.floor ? Number(order.realEstateObject.floor) : undefined,
      }
      : undefined;

    return {
      id: order.id,
      objectAddress: order.objectAddress,
      orderDate: toTimestamp(order.orderDate),
      status: order.status,
      totalAmount: totalAmountNum,
      statusHistory:
        order.statusHistory?.map((h: any) => ({
          status: h.status,
          date: toTimestamp(h.date),
          comment: h.comment,
        })) || [],
      applicantId: order.applicantId,
      applicantName: order.applicantName,
      notaryId: order.notaryId,
      notaryName: order.notaryName,
      plannedCompletionDate: toTimestamp(order.plannedCompletionDate),
      actualCompletionDate: toTimestamp(order.actualCompletionDate),
      transactionId: transactionIdVal,
      realEstateObject: realEstateObject,
    };
  }
}