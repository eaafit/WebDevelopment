import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { PrismaModule } from '@internal/prisma';

@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Get()
  test() {
    return { message: 'Order controller works' };
  }
  async listOrders(
    @Query('user_id') userId: string,
    @Query('role') role: 'applicant' | 'notary',
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('page') page = 1,
    @Query('page_size') pageSize = 10,
  ) {
    return this.orderService.findMany({
      userId,
      role,
      status,
      searchQuery: search,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }
}