import { Injectable, inject } from '@angular/core';
import { createClient } from '@connectrpc/connect';
import { AuthService as RpcAuthService } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT, TokenStore } from '@notary-portal/ui';

@Injectable({ providedIn: 'root' })
export class EstimationFormSessionService {
  private readonly tokenStore = inject(TokenStore);
  private readonly client = createClient(RpcAuthService, inject(RPC_TRANSPORT));

  async ensureUserId(): Promise<string> {
    const currentUserId = this.tokenStore.user()?.id?.trim() ?? '';
    if (currentUserId) {
      return currentUserId;
    }

    const refreshToken = this.tokenStore.getRefreshToken();
    if (!refreshToken) {
      throw new Error('Сессия пользователя недоступна. Авторизуйтесь заново.');
    }

    try {
      const response = await this.client.refreshToken({ refreshToken });
      if (!response.result) {
        throw new Error('Не удалось восстановить пользовательскую сессию.');
      }

      this.tokenStore.setTokens(
        response.result.accessToken,
        response.result.refreshToken,
        response.result.user,
      );
    } catch {
      this.tokenStore.clear();
      throw new Error('Сессия пользователя недоступна. Авторизуйтесь заново.');
    }

    const refreshedUserId = this.tokenStore.user()?.id?.trim() ?? '';
    if (!refreshedUserId) {
      throw new Error('Не удалось определить пользователя текущей сессии.');
    }

    return refreshedUserId;
  }
}
