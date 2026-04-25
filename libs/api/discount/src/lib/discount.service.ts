import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';

@Injectable()
export class DiscountService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDiscountDto) {
    return this.prisma.discount.create({
      data: {
        name: dto.name,
        percentage: dto.percentage,
        description: dto.description,
        isActive: dto.isActive,
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo),
        minOrderAmount: dto.minOrderAmount,
        maxDiscountAmount: dto.maxDiscountAmount,
      },
    });
  }

  async findAll(params: { skip?: number; take?: number; where?: any; orderBy?: any }) {
    return this.prisma.discount.findMany(params);
  }

  async findOne(id: number) {
    return this.prisma.discount.findUnique({ where: { id } });
  }

  async update(id: number, dto: UpdateDiscountDto) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.percentage !== undefined) data.percentage = dto.percentage;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.validFrom !== undefined) data.validFrom = new Date(dto.validFrom);
    if (dto.validTo !== undefined) data.validTo = new Date(dto.validTo);
    if (dto.minOrderAmount !== undefined) data.minOrderAmount = dto.minOrderAmount;
    if (dto.maxDiscountAmount !== undefined) data.maxDiscountAmount = dto.maxDiscountAmount;
    return this.prisma.discount.update({ where: { id }, data });
  }

  async remove(id: number) {
    return this.prisma.discount.delete({ where: { id } });
  }
}
