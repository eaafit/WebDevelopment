import { Injectable, inject } from '@angular/core';
import { createClient } from '@connectrpc/connect';
import { UserService } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '@notary-portal/ui';

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly client = createClient(UserService, inject(RPC_TRANSPORT));
  private usersCache = new Map<string, string>();

  async loadUsers() {
    const response = await this.client.listUsers({
      pagination: { page: 1, limit: 200 },
    });
    for (const user of response.users) {
      this.usersCache.set(user.id, user.fullName);
    }
  }

  getUserName(userId: string): string {
    return this.usersCache.get(userId) || userId.slice(0, 8);
  }
}