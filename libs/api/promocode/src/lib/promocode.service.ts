import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { Prisma } from '@internal/prisma-client';
import { CreatePromocodeDto } from './dto/create-promocode.dto';
import { UpdatePromocodeDto } from './dto/update-promocode.dto';

@Injectable()
export class PromocodeService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePromocodeDto) {
    try {
      return await this.prisma.promocode.create({
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
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Промокод с таким кодом уже существует');
      }
      throw e;
    }
  }

  async findAll(params: { page?: number; limit?: number; where?: any; orderBy?: any }): Promise<{
    items: any[];
    meta: { totalItems: number; totalPages: number; currentPage: number; perPage: number };
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      this.prisma.promocode.findMany({
        where: params.where,
        orderBy: params.orderBy,
        skip,
        take: limit,
      }),
      this.prisma.promocode.count({ where: params.where }),
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
