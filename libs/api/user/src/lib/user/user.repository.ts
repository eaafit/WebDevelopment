import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { PrismaService } from '@internal/prisma';
import { Injectable } from '@nestjs/common';
import {
  ListUsersResponseSchema,
  PaginationMetaSchema,
  UserSchema,
  UserRole as RpcUserRole,
  type ListUsersResponse,
  type User as RpcUser,
} from '@notary-portal/api-contracts';
import { Role as PrismaRole, type Prisma } from '@internal/prisma-client';

export interface UserQuery {
  page: number;
  limit: number;
  roleFilter?: PrismaRole;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Получение одного пользователя ──────────────────────────────────────

  async findById(id: string): Promise<RpcUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.toMessage(user) : null;
  }

  // ─── Обновление профиля ──────────────────────────────────────────────────

  async updateProfile(
    id: string,
    data: { fullName?: string; phoneNumber?: string },
  ): Promise<RpcUser> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.fullName    && { fullName:    data.fullName }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
      },
    });
    return this.toMessage(user);
  }

  // ─── Список пользователей (admin) ────────────────────────────────────────

  async listUsers(query: UserQuery): Promise<ListUsersResponse> {
    const { page, limit } = query;
    const where: Prisma.UserWhereInput = {};
    if (query.roleFilter) where.role = query.roleFilter;

    const [totalItems, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return create(ListUsersResponseSchema, {
      users: users.map((u) => this.toMessage(u)),
      meta: create(PaginationMetaSchema, {
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
        perPage: limit,
      }),
    });
  }

  // ─── Маппинг Prisma → RPC ────────────────────────────────────────────────

  toMessage(u: {
    id: string;
    email: string;
    fullName: string;
    role: PrismaRole;
    phoneNumber: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): RpcUser {
    return create(UserSchema, {
      id:          u.id,
      email:       u.email,
      fullName:    u.fullName,
      role:        this.fromPrismaRole(u.role),
      phoneNumber: u.phoneNumber ?? '',
      isActive:    u.isActive,
      createdAt:   timestampFromDate(u.createdAt),
      updatedAt:   timestampFromDate(u.updatedAt),
    });
  }

  // ─── Хелперы ролей ───────────────────────────────────────────────────────

  fromPrismaRole(role: PrismaRole): RpcUserRole {
    const map: Record<PrismaRole, RpcUserRole> = {
      [PrismaRole.Applicant]: RpcUserRole.APPLICANT,
      [PrismaRole.Notary]:    RpcUserRole.NOTARY,
      [PrismaRole.Admin]:     RpcUserRole.ADMIN,
    };
    return map[role];
  }

  toPrismaRole(role: RpcUserRole): PrismaRole {
    const map: Partial<Record<RpcUserRole, PrismaRole>> = {
      [RpcUserRole.APPLICANT]: PrismaRole.Applicant,
      [RpcUserRole.NOTARY]:    PrismaRole.Notary,
      [RpcUserRole.ADMIN]:     PrismaRole.Admin,
    };
    return map[role] ?? PrismaRole.Applicant;
  }
}
