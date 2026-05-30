import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { PrismaService } from '@internal/prisma';
import { Injectable } from '@nestjs/common';
import {
  UserSchema,
  UserRole as RpcUserRole,
  type User as RpcUser,
} from '@notary-portal/api-contracts';
import { Role as PrismaRole } from '@internal/prisma-client';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  fullName: string;
  phoneNumber?: string;
  role: PrismaRole;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Поиск по email ──────────────────────────────────────────────────────

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // ─── Поиск по id ────────────────────────────────────────────────────────

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // ─── Создание пользователя ───────────────────────────────────────────────

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async createUser(data: CreateUserData): Promise<RpcUser> {
    const user = await this.prisma.user.create({
      data: {
        email:        data.email,
        passwordHash: data.passwordHash,
        fullName:     data.fullName,
        phoneNumber:  data.phoneNumber,
        role:         data.role,
      },
    });
    return this.toMessage(user);
  }

  // ─── Маппинг ─────────────────────────────────────────────────────────────

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
