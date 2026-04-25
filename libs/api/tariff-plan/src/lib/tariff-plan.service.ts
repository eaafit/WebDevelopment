import { Injectable } from '@nestjs/common';
import { PrismaService } from '@notary-portal/prisma';
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

  async findAll(params: { skip?: number; take?: number; where?: any; orderBy?: any }) {
    return this.prisma.tariffPlan.findMany(params);
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
