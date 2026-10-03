import { timestampDate } from '@bufbuild/protobuf/wkt';
import { ConnectError, createClient } from '@connectrpc/connect';
import {
  NotificationService,
  type Notification,
  type NotificationSettings,
  type NotificationStatus,
  type NotificationType,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT } from './rpc-transport';
import { TokenStore } from './token-store';

const DEFAULT_LIMIT = 50;

@Injectable({ providedIn: 'root' })
export class InAppNotificationsApiService {
  private readonly client = createClient(NotificationService, inject(RPC_TRANSPORT));
  private readonly tokenStore = inject(TokenStore);

  async listRecent(limit = 5): Promise<{ notifications: Notification[]; unreadCount: number }> {
    return this.listMine({ page: 1, limit, unreadOnly: true });
  }

  async listMine(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    statuses?: NotificationStatus[];
    types?: NotificationType[];
  }): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      return { notifications: [], unreadCount: 0 };
    }

    const response = await this.client.listNotifications({
      userId,
      pagination: {
        page: params?.page ?? 1,
        limit: params?.limit ?? DEFAULT_LIMIT,
      },
      filters: {
        unreadOnly: params?.unreadOnly ?? false,
        statuses: params?.statuses ?? [],
        types: params?.types ?? [],
      },
    });

    return {
      notifications: response.notifications,
      unreadCount: response.unreadCount,
    };
  }

  async markAsRead(id: string): Promise<void> {
    await this.client.markAsRead({ id });
  }

  async markAllAsRead(): Promise<void> {
    const userId = this.getCurrentUserId();
    if (!userId) return;
    await this.client.markAllAsRead({ userId });
  }

  async deleteNotification(id: string): Promise<void> {
    await this.client.deleteNotification({ id });
  }

  async getNotificationSettings(): Promise<NotificationSettings> {
    const response = await this.client.getNotificationSettings({});
    if (!response.settings) {
      throw new Error('Настройки уведомлений не получены');
    }
    return response.settings;
  }

  async updateNotificationSettings(settings: NotificationSettings): Promise<NotificationSettings> {
    const response = await this.client.updateNotificationSettings({ settings });
    if (!response.settings) {
      throw new Error('Настройки уведомлений не сохранены');
    }
    return response.settings;
  }

  getCurrentUserId(): string | null {
    return this.tokenStore.user()?.id ?? null;
  }
}

export function notificationOccurredAt(notification: Notification): Date {
  return notification.sentAt ? timestampDate(notification.sentAt) : new Date(0);
}

export function mapNotificationRpcError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof ConnectError) {
    return new Error(error.rawMessage || error.message || fallbackMessage);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}
