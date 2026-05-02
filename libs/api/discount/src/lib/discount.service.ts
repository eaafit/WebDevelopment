import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import type { Prisma } from '@internal/prisma-client';
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
    // Тело приходит как plain object; читаем поля без опоры на «класс» DTO.
    const raw = dto as Record<string, unknown>;
    const data: Prisma.DiscountUpdateInput = {};
    if (raw['name'] !== undefined) data.name = String(raw['name']);
    if (raw['percentage'] !== undefined) data.percentage = Number(raw['percentage']);
    if (raw['description'] !== undefined) data.description = raw['description'] as string | null;
    if (raw['isActive'] !== undefined) data.isActive = Boolean(raw['isActive']);
    if (raw['validFrom'] !== undefined) data.validFrom = new Date(String(raw['validFrom']));
    if (raw['validTo'] !== undefined) data.validTo = new Date(String(raw['validTo']));
    if (raw['minOrderAmount'] !== undefined)
      data.minOrderAmount = raw['minOrderAmount'] as number | null;
    if (raw['maxDiscountAmount'] !== undefined)
      data.maxDiscountAmount = raw['maxDiscountAmount'] as number | null;
    return this.prisma.discount.update({ where: { id }, data });
  }

  async remove(id: number) {
    return this.prisma.discount.delete({ where: { id } });
  }
}
