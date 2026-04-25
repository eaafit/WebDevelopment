import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
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
    const data: any = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.discountType !== undefined) data.discountType = dto.discountType;
    if (dto.discountValue !== undefined) data.discountValue = dto.discountValue;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.validFrom !== undefined) data.validFrom = new Date(dto.validFrom);
    if (dto.validTo !== undefined) data.validTo = new Date(dto.validTo);
    if (dto.maxUses !== undefined) data.maxUses = dto.maxUses;
    return this.prisma.promocode.update({ where: { id }, data });
  }

  async remove(id: number) {
    return this.prisma.promocode.delete({ where: { id } });
  }
}
