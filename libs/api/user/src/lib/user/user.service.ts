import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { Injectable } from '@nestjs/common';
import {
  GetProfileResponseSchema,
  GetUserByIdResponseSchema,
  UpdateProfileResponseSchema,
  UserRole as RpcUserRole,
  type GetProfileRequest,
  type GetProfileResponse,
  type GetUserByIdRequest,
  type GetUserByIdResponse,
  type ListUsersRequest,
  type ListUsersResponse,
  type UpdateProfileRequest,
  type UpdateProfileResponse,
} from '@notary-portal/api-contracts';
import { requireRole, requireSelfOrRole, Role } from '@internal/auth-shared';
import { UserRepository } from './user.repository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  // ─── GetProfile ──────────────────────────────────────────────────────────
  // Доступен: сам пользователь или Admin

  async getProfile(request: GetProfileRequest): Promise<GetProfileResponse> {
    validateUuid(request.userId, 'user_id');
    requireSelfOrRole(request.userId, Role.Admin);

    const user = await this.userRepository.findById(request.userId);
    if (!user) throw new ConnectError('user not found', Code.NotFound);

    return create(GetProfileResponseSchema, { user });
  }

  // ─── UpdateProfile ───────────────────────────────────────────────────────
  // Доступен: только сам пользователь (не Admin — чтобы не менять чужие данные)

  async updateProfile(request: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    validateUuid(request.userId, 'user_id');
    requireSelfOrRole(request.userId, Role.Admin);

    const user = await this.userRepository.updateProfile(request.userId, {
      fullName: request.fullName?.trim() || undefined,
      phoneNumber: request.phoneNumber?.trim() || undefined,
    });

    return create(UpdateProfileResponseSchema, { user });
  }

  // ─── GetUserById ─────────────────────────────────────────────────────────
  // Admin-only

  async getUserById(request: GetUserByIdRequest): Promise<GetUserByIdResponse> {
    validateUuid(request.id, 'id');
    requireRole(Role.Admin);

    const user = await this.userRepository.findById(request.id);
    if (!user) throw new ConnectError('user not found', Code.NotFound);

    return create(GetUserByIdResponseSchema, { user });
  }

  // ─── ListUsers ───────────────────────────────────────────────────────────
  // Admin-only

  listUsers(request: ListUsersRequest): Promise<ListUsersResponse> {
    requireRole(Role.Admin);

    const page = normalizePositiveInt(request.pagination?.page, 1);
    const limit = normalizePositiveInt(request.pagination?.limit, 20);
    const roleFilter =
      request.roleFilter !== RpcUserRole.UNSPECIFIED
        ? this.userRepository.toPrismaRole(request.roleFilter)
        : undefined;

    return this.userRepository.listUsers({ page, limit, roleFilter });
  }
}

// ─── Хелперы ────────────────────────────────────────────────────────────────

function validateUuid(value: string | undefined, field: string): void {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new ConnectError(`${field} must be a valid UUID`, Code.InvalidArgument);
  }
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (!value || value === 0) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new ConnectError('pagination values must be positive integers', Code.InvalidArgument);
  }
  return value;
}
