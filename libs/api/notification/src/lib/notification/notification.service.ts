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
  NotificationCategory as RpcNotificationCategory,
  NotificationStatus as RpcNotificationStatus,
  NotificationType,
  NotificationType as RpcNotificationType,
  UpdateNotificationSettingsResponseSchema,
  type Notification as RpcNotification,
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
  isInAppEnabledForCategory,
  type NotificationPreferenceCategory,
} from './notification-preferences';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_PAGE_LIMIT = 100;

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

    const category = (params.category ?? 'system') as NotificationPreferenceCategory;
    const preferenceRows = await this.notificationRepository.getOrCreatePreferenceRows(params.userId);
    if (!isInAppEnabledForCategory(preferenceRows, category)) {
      return;
    }

    await this.notificationRepository.createNotification({
      userId: params.userId,
      title: normalizeOptionalTitle(params.title),
      category: params.category ?? RpcNotificationCategory.SYSTEM,
      message: normalizeMessage(params.message),
      type: params.type ?? RpcNotificationType.PUSH,
      status: params.status ?? RpcNotificationStatus.SENT,
    });
  }

  async createInternalNotificationsForRoles(params: {
    roles: PrismaRole[];
    message: string;
    type?: RpcNotificationType;
    status?: RpcNotificationStatus;
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

  async createInternalNotificationsForRole(
    role: PrismaRole,
    params: Omit<Parameters<NotificationService['createInternalNotification']>[0], 'userId'>,
  ): Promise<void> {
    const userIds = await this.notificationRepository.listActiveUserIdsByRoles([role]);

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
    const currentUser = requireAuth();
    if (currentUser.sub !== request.userId) {
      throw new ConnectError('access denied: can only list own notifications', Code.PermissionDenied);
    }

    return this.notificationRepository.listNotifications({
      page: normalizePositiveInt(request.pagination?.page, DEFAULT_PAGE, 'pagination.page'),
      limit: normalizePageLimit(request.pagination?.limit),
      userId: request.userId,
      types: normalizeRepeatedEnumFilter(
        request.filters?.types,
        RpcNotificationType.UNSPECIFIED,
      ),
      statuses: normalizeRepeatedEnumFilter(
        request.filters?.statuses,
        RpcNotificationStatus.UNSPECIFIED,
      ),
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

    const settings = await this.notificationRepository.getOrCreatePreferencesMatrix(userId);
    return create(GetNotificationSettingsResponseSchema, {
      settings,
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

    const settings = await this.notificationRepository.updatePreferencesMatrix(
      userId,
      request.settings,
    );

    return create(UpdateNotificationSettingsResponseSchema, {
      settings,
    });
  }
}

function validateUuid(value: string | undefined, fieldName: string): void {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new ConnectError(`${fieldName} must be a valid UUID`, Code.InvalidArgument);
  }
}

function normalizeMessage(message: string): string {
  const normalized = message.trim();
  if (!normalized) {
    throw new ConnectError('message is required', Code.InvalidArgument);
  }
  return normalized;
}

function toPrismaType(type: RpcNotificationType | undefined): PrismaNotificationType | undefined {
  switch (type) {
    case RpcNotificationType.EMAIL:
      return PrismaNotificationType.Email;
    case RpcNotificationType.SMS:
      return PrismaNotificationType.SMS;
    case RpcNotificationType.PUSH:
      return PrismaNotificationType.Push;
    case RpcNotificationType.IN_APP:
      return PrismaNotificationType.InApp;
    case undefined:
    default:
      return undefined;
  }
}

function toPrismaStatus(status: RpcNotificationStatus | undefined): PrismaNotificationStatus | undefined {
  switch (status) {
    case RpcNotificationStatus.FAILED:
      return PrismaNotificationStatus.Failed;
    case RpcNotificationStatus.SENT:
      return PrismaNotificationStatus.Sent;
    case RpcNotificationStatus.PENDING:
      return PrismaNotificationStatus.Pending;
    case undefined:
    default:
      return undefined;
  }
}

function normalizeOptionalTitle(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizePageLimit(value: number | undefined): number {
  const limit = normalizePositiveInt(value, DEFAULT_LIMIT, 'pagination.limit');

  if (limit > MAX_PAGE_LIMIT) {
    throw new ConnectError(
      `pagination.limit must not exceed ${MAX_PAGE_LIMIT}`,
      Code.InvalidArgument,
    );
  }

  return limit;
}

function normalizePositiveInt(
  value: number | undefined,
  fallback: number,
  fieldName: string,
): number {
  if (value === undefined || value === 0) {
    return fallback;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new ConnectError(`${fieldName} must be a positive integer`, Code.InvalidArgument);
  }

  return value;
}

function normalizeRepeatedEnumFilter<T extends number>(
  values: T[] | undefined,
  unspecifiedValue: T,
): T[] | undefined {
  const normalized = [...new Set((values ?? []).filter((value) => value !== unspecifiedValue))];
  return normalized.length ? normalized : undefined;
}
