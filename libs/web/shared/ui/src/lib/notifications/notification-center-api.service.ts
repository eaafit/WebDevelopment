import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { Injectable, inject } from '@angular/core';
import { from, map, type Observable } from 'rxjs';
import {
  NotificationService,
  NotificationStatus,
  NotificationType,
  type ListNotificationsResponse,
  type Notification,
} from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '../rpc/rpc-transport';

export type NotificationCenterChannel = 'email' | 'sms' | 'push';
export type NotificationCenterDomainType = 'application' | 'document' | 'payment' | 'system';
export type NotificationCenterLifecycle = 'created' | 'sent' | 'read' | 'failed';

export interface NotificationCenterItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  relativeTime: string;
  type: NotificationCenterDomainType;
  channel: NotificationCenterChannel;
  lifecycle: NotificationCenterLifecycle;
}

export interface NotificationCenterPage {
  notifications: NotificationCenterItem[];
  unreadCount: number;
  totalItems: number;
}

export interface NotificationCenterQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  statuses?: NotificationStatus[];
  types?: NotificationType[];
}

@Injectable({ providedIn: 'root' })
export class NotificationCenterApiService {
  private readonly client = createClient(NotificationService, inject(RPC_TRANSPORT));

  listNotifications(
    userId: string,
    query: NotificationCenterQuery = {},
  ): Observable<NotificationCenterPage> {
    return from(
      this.client.listNotifications({
        userId,
        pagination: {
          page: query.page ?? 1,
          limit: query.limit ?? 50,
        },
        filters: {
          statuses: query.statuses ?? [],
          types: query.types ?? [],
          unreadOnly: query.unreadOnly ?? false,
        },
      }),
    ).pipe(map((response) => toNotificationCenterPage(response)));
  }

  markAsRead(id: string): Observable<NotificationCenterItem> {
    return from(this.client.markAsRead({ id })).pipe(
      map((response) => toNotificationCenterItem(response.notification)),
    );
  }

  markAllAsRead(userId: string): Observable<number> {
    return from(this.client.markAllAsRead({ userId })).pipe(
      map((response) => response.updatedCount),
    );
  }

  deleteNotification(id: string): Observable<boolean> {
    return from(this.client.deleteNotification({ id })).pipe(map((response) => response.success));
  }
}

function toNotificationCenterPage(response: ListNotificationsResponse): NotificationCenterPage {
  return {
    notifications: response.notifications.map(toNotificationCenterItem),
    totalItems: response.meta?.totalItems ?? response.notifications.length,
    unreadCount: response.unreadCount,
  };
}

function toNotificationCenterItem(notification?: Notification): NotificationCenterItem {
  const message = notification?.message?.trim() || 'Системное уведомление';
  const createdAt = notification?.sentAt ? timestampDate(notification.sentAt).toISOString() : '';
  const title = buildTitle(message);

  return {
    id: notification?.id ?? '',
    title,
    description: buildDescription(message, title),
    createdAt,
    relativeTime: formatRelativeTime(createdAt),
    type: inferDomainType(message),
    channel: toChannel(notification?.type ?? NotificationType.PUSH),
    lifecycle: toLifecycle(
      notification?.status ?? NotificationStatus.SENT,
      Boolean(notification?.readAt),
    ),
  };
}

function buildTitle(message: string): string {
  const firstSentence = message.split(/[.!?]\s/)[0]?.trim() || message;
  return firstSentence.length > 90 ? `${firstSentence.slice(0, 87)}...` : firstSentence;
}

function buildDescription(message: string, title: string): string {
  const normalized = message.trim();
  return normalized === title ? 'Уведомление из системы нотариального портала.' : normalized;
}

function inferDomainType(message: string): NotificationCenterDomainType {
  const normalized = message.toLowerCase();
  if (/заявк|оценк|заказ/.test(normalized)) return 'application';
  if (/документ|отчет|отчёт|файл|pdf/.test(normalized)) return 'document';
  if (/плат[её]ж|счет|сч[её]т|подписк|оплат/.test(normalized)) return 'payment';
  return 'system';
}

function toChannel(type: NotificationType): NotificationCenterChannel {
  switch (type) {
    case NotificationType.EMAIL:
      return 'email';
    case NotificationType.SMS:
      return 'sms';
    case NotificationType.PUSH:
    default:
      return 'push';
  }
}

function toLifecycle(status: NotificationStatus, isRead: boolean): NotificationCenterLifecycle {
  if (isRead) return 'read';
  if (status === NotificationStatus.PENDING) return 'created';
  if (status === NotificationStatus.FAILED) return 'failed';
  return 'sent';
}

function formatRelativeTime(value: string): string {
  if (!value) return '';

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return '';

  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (diffMinutes < 1) return 'только что';
  if (diffMinutes < 60) return `${diffMinutes} мин назад`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'вчера';
  return `${diffDays} дн назад`;
}
