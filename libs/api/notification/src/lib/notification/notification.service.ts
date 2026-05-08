import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  NotificationStatus as PrismaNotificationStatus,
  NotificationType as PrismaNotificationType,
  Role as PrismaRole,
} from '@internal/prisma-client';
import {
  DeleteNotificationResponseSchema,
  MarkAllAsReadResponseSchema,
  MarkAsReadResponseSchema,
  NotificationStatus,
  NotificationType,
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
import { NotificationRepository } from './notification.repository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class NotificationService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async createInternalNotification(params: {
    userId: string;
    message: string;
    type?: NotificationType;
    status?: NotificationStatus;
  }): Promise<void> {
    validateUuid(params.userId, 'user_id');

    await this.notificationRepository.createNotification({
      userId: params.userId,
      message: params.message,
      type: toPrismaType(params.type),
      status: toPrismaStatus(params.status),
    });
  }

  async createInternalNotificationsForRoles(params: {
    roles: PrismaRole[];
    message: string;
    type?: NotificationType;
    status?: NotificationStatus;
  }): Promise<void> {
    const userIds = await this.notificationRepository.listActiveUserIdsByRoles(params.roles);

    await this.notificationRepository.createManyNotifications({
      userIds,
      message: params.message,
      type: toPrismaType(params.type),
      status: toPrismaStatus(params.status),
    });
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

function toPrismaType(type: NotificationType | undefined): PrismaNotificationType | undefined {
  switch (type) {
    case NotificationType.EMAIL:
      return PrismaNotificationType.Email;
    case NotificationType.SMS:
      return PrismaNotificationType.SMS;
    case NotificationType.PUSH:
      return PrismaNotificationType.Push;
    case NotificationType.UNSPECIFIED:
    case undefined:
    default:
      return undefined;
  }
}

function toPrismaStatus(status: NotificationStatus | undefined): PrismaNotificationStatus | undefined {
  switch (status) {
    case NotificationStatus.FAILED:
      return PrismaNotificationStatus.Failed;
    case NotificationStatus.SENT:
      return PrismaNotificationStatus.Sent;
    case NotificationStatus.PENDING:
      return PrismaNotificationStatus.Pending;
    case NotificationStatus.UNSPECIFIED:
    case undefined:
    default:
      return undefined;
  }
}
