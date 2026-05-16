import { createClient } from '@connectrpc/connect';
import {
  NotificationService,
  type Notification,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT } from '@notary-portal/ui';

const PAGE_LIMIT = 100;

@Injectable({ providedIn: 'root' })
export class AdminNotificationsApiService {
  private readonly client = createClient(NotificationService, inject(RPC_TRANSPORT));

  async listNotifications(userId: string): Promise<Notification[]> {
    const result: Notification[] = [];
    let page = 1;

    while (true) {
      const response = await this.client.listNotifications({
        userId,
        pagination: {
          page,
          limit: PAGE_LIMIT,
        },
      });

      result.push(...response.notifications);

      const totalPages = response.meta?.totalPages ?? 1;
      if (page >= totalPages || response.notifications.length === 0) {
        break;
      }

      page += 1;
    }

    return result;
  }

  async markAsRead(id: string): Promise<void> {
    await this.client.markAsRead({ id });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.client.markAllAsRead({ userId });
  }

  async deleteNotification(id: string): Promise<void> {
    await this.client.deleteNotification({ id });
  }
}
