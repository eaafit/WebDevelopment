import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  NotificationCategory as RpcNotificationCategory,
  NotificationService,
  NotificationStatus as RpcNotificationStatus,
  NotificationType as RpcNotificationType,
  type Notification as RpcNotification,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import {
  parseJwtPayload,
  RPC_TRANSPORT,
  TokenStore,
  WebLoggerService,
} from '@notary-portal/ui';

const PAGE_LIMIT = 100;

export type AdminNotificationChannel = 'in-app' | 'email' | 'push' | 'sms';
export type AdminNotificationCategory =
  | 'application'
  | 'document'
  | 'payment'
  | 'system'
  | 'assessment';

export interface AdminNotificationRecord {
  id: string;
  title: string;
  message: string;
  category: AdminNotificationCategory;
  channel: AdminNotificationChannel;
  deliveryStatus: 'created' | 'sent' | 'failed';
  sentAt: Date;
  readAt: Date | null;
}

@Injectable({ providedIn: 'root' })
export class AdminNotificationsApiService {
  private readonly client = createClient(NotificationService, inject(RPC_TRANSPORT));
  private readonly tokenStore = inject(TokenStore);
  private readonly logger = inject(WebLoggerService);

  async listNotifications(): Promise<{
    notifications: AdminNotificationRecord[];
    unreadCount: number;
  }> {
    const userId = this.resolveCurrentUserId();
    const notifications: AdminNotificationRecord[] = [];
    let unreadCount = 0;
    let page = 1;

    while (true) {
      const response = await this.client.listNotifications({
        userId,
        pagination: { page, limit: PAGE_LIMIT },
        filters: {},
      });

      unreadCount = response.unreadCount;
      notifications.push(...response.notifications.map((item) => toAdminNotificationRecord(item)));

      const totalPages = response.meta?.totalPages ?? 1;
      if (page >= totalPages || response.notifications.length === 0) {
        break;
      }

      page += 1;
    }

    this.logger.info('notification.admin.api.list_succeeded', {
      area: 'admin_notifications_api',
      total: notifications.length,
      unreadCount,
    });

    return { notifications, unreadCount };
  }

  async markAsRead(id: string): Promise<AdminNotificationRecord | null> {
    const response = await this.client.markAsRead({ id });
    return response.notification ? toAdminNotificationRecord(response.notification) : null;
  }

  async markAllAsRead(): Promise<number> {
    const response = await this.client.markAllAsRead({
      userId: this.resolveCurrentUserId(),
    });
    return response.updatedCount;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const response = await this.client.deleteNotification({ id });
    return response.success;
  }

  private resolveCurrentUserId(): string {
    const storeUserId = this.tokenStore.user()?.id?.trim();
    if (storeUserId) {
      return storeUserId;
    }

    const token = this.tokenStore.getAccessToken();
    const tokenUserId = token ? parseJwtPayload(token)?.sub?.trim() : '';
    if (tokenUserId) {
      return tokenUserId;
    }

    throw new Error('Не удалось определить текущего администратора');
  }
}

function toAdminNotificationRecord(notification: RpcNotification): AdminNotificationRecord {
  return {
    id: notification.id,
    title: notification.title || fallbackTitle(notification),
    message: notification.message,
    category: toCategory(notification.category, notification.message),
    channel: toChannel(notification.type),
    deliveryStatus: toDeliveryStatus(notification.status),
    sentAt: notification.sentAt ? timestampDate(notification.sentAt) : new Date(),
    readAt: notification.readAt ? timestampDate(notification.readAt) : null,
  };
}

function toChannel(type: RpcNotificationType): AdminNotificationRecord['channel'] {
  switch (type) {
    case RpcNotificationType.EMAIL:
      return 'email';
    case RpcNotificationType.SMS:
      return 'sms';
    case RpcNotificationType.PUSH:
      return 'push';
    case RpcNotificationType.IN_APP:
    case RpcNotificationType.UNSPECIFIED:
    default:
      return 'in-app';
  }
}

function toCategory(
  category: RpcNotificationCategory,
  message: string,
): AdminNotificationRecord['category'] {
  switch (category) {
    case RpcNotificationCategory.APPLICATION:
      return 'application';
    case RpcNotificationCategory.DOCUMENT:
      return 'document';
    case RpcNotificationCategory.PAYMENT:
      return 'payment';
    case RpcNotificationCategory.ASSESSMENT:
      return 'assessment';
    case RpcNotificationCategory.SYSTEM:
      return 'system';
    case RpcNotificationCategory.UNSPECIFIED:
    default:
      return inferCategory(message);
  }
}

function toDeliveryStatus(
  status: RpcNotificationStatus,
): AdminNotificationRecord['deliveryStatus'] {
  switch (status) {
    case RpcNotificationStatus.PENDING:
      return 'created';
    case RpcNotificationStatus.FAILED:
      return 'failed';
    case RpcNotificationStatus.SENT:
    case RpcNotificationStatus.UNSPECIFIED:
    default:
      return 'sent';
  }
}

function fallbackTitle(notification: RpcNotification): string {
  const separatorIndex = notification.message.indexOf(':');
  if (separatorIndex > 0) {
    return notification.message.slice(0, separatorIndex).trim();
  }

  return inferCategory(notification.message) === 'payment'
    ? 'Платёжное событие'
    : 'Уведомление';
}

function inferCategory(message: string): AdminNotificationRecord['category'] {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('плат') ||
    normalized.includes('оплат') ||
    normalized.includes('подписк') ||
    normalized.includes('yookassa')
  ) {
    return 'payment';
  }

  if (normalized.includes('оценк')) {
    return 'assessment';
  }

  if (normalized.includes('заявк')) {
    return 'application';
  }

  if (normalized.includes('документ') || normalized.includes('копи')) {
    return 'document';
  }

  return 'system';
}
