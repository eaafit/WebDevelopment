import { Controller, Get, Post, Body, Put, Param, Delete, Query } from '@nestjs/common';
import { DiscountService } from './discount.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';

@Controller('discounts')
export class DiscountController {
  constructor(private readonly service: DiscountService) {}

  @Post()
  create(@Body() dto: CreateDiscountDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('filterName') filterName?: string,
    @Query('filterStatus') filterStatus?: string,
    @Query('filterDateFrom') filterDateFrom?: string,
    @Query('filterDateTo') filterDateTo?: string,
    @Query('sortField') sortField?: string,
    @Query('sortDirection') sortDirection?: 'asc' | 'desc',
  ) {
    const where: any = {};
    if (filterName) where.name = { contains: filterName, mode: 'insensitive' };
    if (filterStatus === 'active') where.isActive = true;
    if (filterStatus === 'inactive') where.isActive = false;
    if (filterDateFrom) where.validFrom = { gte: new Date(filterDateFrom) };
    if (filterDateTo) where.validTo = { lte: new Date(filterDateTo) };
    const orderBy = sortField ? { [sortField]: sortDirection || 'asc' } : undefined;
    return this.service.findAll({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      where,
      orderBy,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDiscountDto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
