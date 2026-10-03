/**
 * Admin-side cache wrapper around UserService.ListUsers.
 *
 * Used by admin orders/dashboard to render an applicant's full name
 * for an Assessment.user_id, since the proto Assessment message
 * does not carry the name. ListUsers is admin-only on the backend.
 *
 * Loaded lazily on the first loadUsers() call and cached for the
 * lifetime of the page. Callers can render UI synchronously via
 * getUserName(); if the cache hasn't loaded yet, a short id stub
 * is returned as a placeholder.
 */
import { ConnectError, createClient } from '@connectrpc/connect';
import {
  UserRole as RpcUserRole,
  UserService,
  type User as RpcUser,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT } from '@notary-portal/ui';

const PAGE_LIMIT = 200;

export type AdminUserKnownRole = 'Applicant' | 'Notary' | 'Admin' | 'Unknown';

export interface AdminUserRef {
  id: string;
  fullName: string;
  email: string;
  role: AdminUserKnownRole;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminUserApiService {
  private readonly client = createClient(UserService, inject(RPC_TRANSPORT));
  private cache: Promise<Map<string, AdminUserRef>> | null = null;
  private snapshot: ReadonlyMap<string, AdminUserRef> = new Map();

  async loadUsers(): Promise<void> {
    if (!this.cache) {
      this.cache = this.fetchAllUsers();
    }
    try {
      this.snapshot = await this.cache;
    } catch (error) {
      this.cache = null;
      throw mapUserError(error, 'Не удалось загрузить список пользователей');
    }
  }

  invalidateCache(): void {
    this.cache = null;
    this.snapshot = new Map();
  }

  getUserName(userId: string): string {
    if (!userId) return '—';
    const found = this.snapshot.get(userId);
    if (found) return found.fullName;
    return userId.slice(0, 8);
  }

  get usersById(): ReadonlyMap<string, AdminUserRef> {
    return this.snapshot;
  }

  private async fetchAllUsers(): Promise<Map<string, AdminUserRef>> {
    const result = new Map<string, AdminUserRef>();
    let page = 1;

    while (true) {
      const response = await this.client.listUsers({
        pagination: { page, limit: PAGE_LIMIT },
      });

      for (const user of response.users) {
        result.set(user.id, toAdminUserRef(user));
      }

      const totalPages = response.meta?.totalPages ?? 1;
      if (page >= totalPages || response.users.length === 0) {
        break;
      }
      page += 1;
    }

    return result;
  }
}

export function toAdminUserRef(user: RpcUser): AdminUserRef {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: fromRpcRole(user.role),
    isActive: user.isActive,
  };
}

export function fromRpcRole(role: RpcUserRole): AdminUserKnownRole {
  switch (role) {
    case RpcUserRole.APPLICANT:
      return 'Applicant';
    case RpcUserRole.NOTARY:
      return 'Notary';
    case RpcUserRole.ADMIN:
      return 'Admin';
    case RpcUserRole.UNSPECIFIED:
    default:
      return 'Unknown';
  }
}

function mapUserError(error: unknown, fallback: string): Error {
  if (error instanceof ConnectError) {
    return new Error(error.rawMessage || error.message || fallback);
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(fallback);
}
