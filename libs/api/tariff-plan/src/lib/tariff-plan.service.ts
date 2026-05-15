import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { CreateTariffPlanDto } from './dto/create-tariff-plan.dto';
import { UpdateTariffPlanDto } from './dto/update-tariff-plan.dto';

@Injectable()
export class TariffPlanService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTariffPlanDto) {
    return this.prisma.tariffPlan.create({
      data: {
        name: dto.name,
        price: dto.price,
        description: dto.description,
        isActive: dto.isActive,
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo),
      },
    });
  }

  async findAll(params: { page?: number; limit?: number; where?: any; orderBy?: any }): Promise<{
    items: any[];
    meta: { totalItems: number; totalPages: number; currentPage: number; perPage: number };
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      this.prisma.tariffPlan.findMany({
        where: params.where,
        orderBy: params.orderBy,
        skip,
        take: limit,
      }),
      this.prisma.tariffPlan.count({ where: params.where }),
    ]);

    return {
      items,
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        perPage: limit,
      },
    };
  }

  async findOne(id: number) {
    return this.prisma.tariffPlan.findUnique({ where: { id } });
  }

  async update(id: number, dto: UpdateTariffPlanDto) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.validFrom !== undefined) data.validFrom = new Date(dto.validFrom);
    if (dto.validTo !== undefined) data.validTo = new Date(dto.validTo);
    return this.prisma.tariffPlan.update({ where: { id }, data });
  }

  async remove(id: number) {
    return this.prisma.tariffPlan.delete({ where: { id } });
  }
}
