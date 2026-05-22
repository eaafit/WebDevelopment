import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  DeleteNotificationResponseSchema,
  MarkAllAsReadResponseSchema,
  MarkAsReadResponseSchema,
  NotificationCategory as RpcNotificationCategory,
  NotificationStatus as RpcNotificationStatus,
  NotificationType as RpcNotificationType,
  type Notification as RpcNotification,
  type DeleteNotificationRequest,
  type DeleteNotificationResponse,
  type ListNotificationsRequest,
  type ListNotificationsResponse,
  type MarkAllAsReadRequest,
  type MarkAllAsReadResponse,
  type MarkAsReadRequest,
  type MarkAsReadResponse,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';
import { Role as PrismaRole } from '@internal/prisma-client';
import { NotificationRepository } from './notification.repository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CreateNotificationInput {
  userId: string;
  title?: string;
  category?: RpcNotificationCategory;
  type: RpcNotificationType;
  message: string;
  status?: RpcNotificationStatus;
  sentAt?: Date;
  readAt?: Date | null;
}

@Injectable()
export class NotificationService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async createNotification(request: CreateNotificationInput): Promise<RpcNotification> {
    validateUuid(request.userId, 'user_id');

    const message = normalizeMessage(request.message);

    return this.notificationRepository.createNotification({
      userId: request.userId,
      title: normalizeOptionalTitle(request.title),
      type: request.type,
      category: request.category,
      message,
      status: request.status,
      sentAt: request.sentAt,
      readAt: request.readAt,
    });
  }

  async createInternalNotification(params: {
    userId: string;
    title?: string;
    category?: RpcNotificationCategory;
    message: string;
    type?: RpcNotificationType;
    status?: RpcNotificationStatus;
  }): Promise<void> {
    validateUuid(params.userId, 'user_id');

    await this.notificationRepository.createNotification({
      userId: params.userId,
      title: normalizeOptionalTitle(params.title),
      category: params.category ?? RpcNotificationCategory.SYSTEM,
      message: normalizeMessage(params.message),
      type: params.type ?? RpcNotificationType.PUSH,
      status: params.status ?? RpcNotificationStatus.SENT,
    });
  }

  async createInternalNotificationsForRole(
    role: PrismaRole,
    params: Omit<Parameters<NotificationService['createInternalNotification']>[0], 'userId'>,
  ): Promise<void> {
    const userIds = await this.notificationRepository.listActiveUserIdsByRole(role);

    await Promise.all(
      userIds.map((userId) =>
        this.createInternalNotification({
          userId,
          ...params,
        }),
      ),
    );
  }

  listNotifications(request: ListNotificationsRequest): Promise<ListNotificationsResponse> {
    validateUuid(request.userId, 'user_id');
    return this.notificationRepository.listNotifications({
      page:     request.pagination?.page  || 1,
      limit:    request.pagination?.limit || 10,
      userId:   request.userId,
      types:    request.filters?.types?.length    ? request.filters.types    : undefined,
      statuses: request.filters?.statuses?.length ? request.filters.statuses : undefined,
      unreadOnly: request.filters?.unreadOnly ?? false,
    });
  }

  async markAsRead(request: MarkAsReadRequest): Promise<MarkAsReadResponse> {
    validateUuid(request.id, 'id');
    const notification = await this.notificationRepository.markAsRead(request.id);
    return create(MarkAsReadResponseSchema, { notification });
  }

  async markAllAsRead(request: MarkAllAsReadRequest): Promise<MarkAllAsReadResponse> {
    validateUuid(request.userId, 'user_id');
    const updatedCount = await this.notificationRepository.markAllAsRead(request.userId);
    return create(MarkAllAsReadResponseSchema, { updatedCount });
  }

  async deleteNotification(request: DeleteNotificationRequest): Promise<DeleteNotificationResponse> {
    validateUuid(request.id, 'id');
    const success = await this.notificationRepository.deleteNotification(request.id);
    return create(DeleteNotificationResponseSchema, { success });
  }
}

function validateUuid(value: string | undefined, fieldName: string): void {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new ConnectError(`${fieldName} must be a valid UUID`, Code.InvalidArgument);
  }
}

function normalizeMessage(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new ConnectError('message is required', Code.InvalidArgument);
  }

  return normalized;
}

function normalizeOptionalTitle(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
