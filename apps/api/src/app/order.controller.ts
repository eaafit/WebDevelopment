import { Controller, Get, Query, Param } from '@nestjs/common';

@Controller('orders')
export class OrderController {
  @Get()
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
    // Пока возвращаем тестовый ответ
    return {
      orders: [],
      totalCount: 0,
      totalPages: 0,
    };
  }
}