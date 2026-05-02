import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import type { Prisma } from '@internal/prisma-client';
import { CreatePromocodeDto } from './dto/create-promocode.dto';
import { UpdatePromocodeDto } from './dto/update-promocode.dto';

@Injectable()
export class PromocodeService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePromocodeDto) {
    return this.prisma.promocode.create({
      data: {
        code: dto.code,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        description: dto.description,
        isActive: dto.isActive,
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo),
        maxUses: dto.maxUses,
        usedCount: 0,
      },
    });
  }

  async findAll(params: { skip?: number; take?: number; where?: any; orderBy?: any }) {
    return this.prisma.promocode.findMany(params);
  }

  async findOne(id: number) {
    return this.prisma.promocode.findUnique({ where: { id } });
  }

  async update(id: number, dto: UpdatePromocodeDto) {
    const raw = dto as Record<string, unknown>;
    const data: Prisma.PromocodeUpdateInput = {};
    if (raw['code'] !== undefined) data.code = String(raw['code']);
    if (raw['discountType'] !== undefined) data.discountType = String(raw['discountType']);
    if (raw['discountValue'] !== undefined) data.discountValue = Number(raw['discountValue']);
    if (raw['description'] !== undefined) data.description = raw['description'] as string | null;
    if (raw['isActive'] !== undefined) data.isActive = Boolean(raw['isActive']);
    if (raw['validFrom'] !== undefined) data.validFrom = new Date(String(raw['validFrom']));
    if (raw['validTo'] !== undefined) data.validTo = new Date(String(raw['validTo']));
    if (raw['maxUses'] !== undefined) data.maxUses = Number(raw['maxUses']);
    return this.prisma.promocode.update({ where: { id }, data });
  }

  async remove(id: number) {
    return this.prisma.promocode.delete({ where: { id } });
  }
}
