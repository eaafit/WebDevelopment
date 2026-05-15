import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  NotificationStatus as PrismaNotificationStatus,
  NotificationType as PrismaNotificationType,
  Role as PrismaRole,
} from '@internal/prisma-client';
import { getCurrentUser, requireAuth } from '@internal/auth-shared';
import {
  DeleteNotificationResponseSchema,
  GetNotificationSettingsResponseSchema,
  MarkAllAsReadResponseSchema,
  MarkAsReadResponseSchema,
  NotificationStatus,
  NotificationType,
  UpdateNotificationSettingsResponseSchema,
  type DeleteNotificationRequest,
  type DeleteNotificationResponse,
  type GetNotificationSettingsRequest,
  type GetNotificationSettingsResponse,
  type ListNotificationsRequest,
  type ListNotificationsResponse,
  type MarkAllAsReadRequest,
  type MarkAllAsReadResponse,
  type MarkAsReadRequest,
  type MarkAsReadResponse,
  type UpdateNotificationSettingsRequest,
  type UpdateNotificationSettingsResponse,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import {
  fromRpcNotificationSettings,
  isInAppEnabledForCategory,
  toRpcNotificationSettings,
  type NotificationPreferenceCategory,
} from './notification-preferences';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class NotificationService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async createInternalNotification(params: {
    userId: string;
    message: string;
    type?: NotificationType;
    status?: NotificationStatus;
    category?: NotificationPreferenceCategory;
  }): Promise<void> {
    validateUuid(params.userId, 'user_id');

    const category = params.category ?? 'system';
    const preferences = await this.notificationRepository.getOrCreatePreferences(params.userId);
    if (!isInAppEnabledForCategory(preferences, category)) {
      return;
    }

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
    category?: NotificationPreferenceCategory;
  }): Promise<void> {
    const userIds = await this.notificationRepository.listActiveUserIdsByRoles(params.roles);
    const enabledUserIds = await this.notificationRepository.filterUserIdsWithInAppEnabled(
      userIds,
      params.category ?? 'assessment',
    );

    await this.notificationRepository.createManyNotifications({
      userIds: enabledUserIds,
      message: params.message,
      type: toPrismaType(params.type),
      status: toPrismaStatus(params.status),
    });
  }

  listNotifications(request: ListNotificationsRequest): Promise<ListNotificationsResponse> {
    validateUuid(request.userId, 'user_id');
    const currentUser = requireAuth();
    if (currentUser.sub !== request.userId) {
      throw new ConnectError('access denied: can only list own notifications', Code.PermissionDenied);
    }

    return this.notificationRepository.listNotifications({
      page: request.pagination?.page || 1,
      limit: request.pagination?.limit || 10,
      userId: request.userId,
      types: request.filters?.types?.length ? request.filters.types : undefined,
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
    const currentUser = requireAuth();
    if (currentUser.sub !== request.userId) {
      throw new ConnectError('access denied: can only mark own notifications', Code.PermissionDenied);
    }

    const updatedCount = await this.notificationRepository.markAllAsRead(request.userId);
    return create(MarkAllAsReadResponseSchema, { updatedCount });
  }

  async deleteNotification(request: DeleteNotificationRequest): Promise<DeleteNotificationResponse> {
    validateUuid(request.id, 'id');
    const success = await this.notificationRepository.deleteNotification(request.id);
    return create(DeleteNotificationResponseSchema, { success });
  }

  async getNotificationSettings(
    _request: GetNotificationSettingsRequest,
  ): Promise<GetNotificationSettingsResponse> {
    const userId = getCurrentUser()?.sub;
    if (!userId) {
      throw new ConnectError('authentication required', Code.Unauthenticated);
    }

    const preferences = await this.notificationRepository.getOrCreatePreferences(userId);
    return create(GetNotificationSettingsResponseSchema, {
      settings: toRpcNotificationSettings(preferences),
    });
  }

  async updateNotificationSettings(
    request: UpdateNotificationSettingsRequest,
  ): Promise<UpdateNotificationSettingsResponse> {
    const userId = getCurrentUser()?.sub;
    if (!userId) {
      throw new ConnectError('authentication required', Code.Unauthenticated);
    }

    if (!request.settings) {
      throw new ConnectError('settings is required', Code.InvalidArgument);
    }

    const preferences = await this.notificationRepository.updatePreferences(
      fromRpcNotificationSettings(userId, request.settings),
    );

    return create(UpdateNotificationSettingsResponseSchema, {
      settings: toRpcNotificationSettings(preferences),
    });
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
