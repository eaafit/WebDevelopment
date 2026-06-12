import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { requireAuth } from '@internal/auth-shared';
import { AuditService } from '@internal/audit';
import { MetricsService, type NotificationChannel } from '@internal/metrics';
import {
  NotificationStatus as PrismaNotificationStatus,
  NotificationType as PrismaNotificationType,
  Role as PrismaRole,
} from '@internal/prisma-client';
import {
  BusinessOperations,
  NotarySpanAttributes,
  normalizeSpanActorRole,
  runInSpan,
  setSpanAttributes,
} from '@internal/tracing';
import { Injectable } from '@nestjs/common';
import {
  DeleteNotificationResponseSchema,
  GetNotificationSettingsResponseSchema,
  MarkAllAsReadResponseSchema,
  MarkAsReadResponseSchema,
  NotificationCategory as RpcNotificationCategory,
  NotificationStatus as RpcNotificationStatus,
  NotificationType as RpcNotificationType,
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
  type Notification as RpcNotification,
  type UpdateNotificationSettingsRequest,
  type UpdateNotificationSettingsResponse,
} from '@notary-portal/api-contracts';
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
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly metricsService: MetricsService,
    private readonly auditService: AuditService,
  ) {}

  async createNotification(request: CreateNotificationInput): Promise<RpcNotification> {
    return runInSpan(
      'NotificationService.createNotification',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.notificationCreate,
        [NotarySpanAttributes.entity]: 'Notification',
        'notification.category': formatNotificationCategory(request.category),
        'notification.type': formatNotificationType(request.type),
      },
      async () => {
        validateUuid(request.userId, 'user_id');

        const message = normalizeMessage(request.message);

        this.recordNotificationMetricsBestEffort(request.type, request.category);

        const notification = await this.notificationRepository.createNotification({
          userId: request.userId,
          title: normalizeOptionalTitle(request.title),
          type: request.type,
          category: request.category,
          message,
          status: request.status,
          sentAt: request.sentAt,
          readAt: request.readAt,
        });

        await this.recordNotificationAuditEvent(notification, false);

        return notification;
      },
    );
  }

  async createInternalNotification(params: {
    userId: string;
    title?: string;
    category?: RpcNotificationCategory;
    message: string;
    type?: RpcNotificationType;
    status?: RpcNotificationStatus;
  }): Promise<void> {
    return runInSpan(
      'NotificationService.createInternalNotification',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.notificationCreateInternal,
        [NotarySpanAttributes.entity]: 'Notification',
        'notification.category': formatNotificationCategory(params.category),
        'notification.type': formatNotificationType(params.type ?? RpcNotificationType.PUSH),
      },
      async () => {
        validateUuid(params.userId, 'user_id');

        const category = toPreferenceCategory(params.category);
        const preferenceRows = await this.notificationRepository.getOrCreatePreferenceRows(
          params.userId,
        );
        if (!isInAppEnabledForCategory(preferenceRows, category)) {
          return;
        }

        const notificationType = params.type ?? RpcNotificationType.PUSH;

        this.recordNotificationMetricsBestEffort(notificationType, params.category);

        const notification = await this.notificationRepository.createNotification({
          userId: params.userId,
          title: normalizeOptionalTitle(params.title),
          category: params.category ?? RpcNotificationCategory.SYSTEM,
          message: normalizeMessage(params.message),
          type: notificationType,
          status: params.status ?? RpcNotificationStatus.SENT,
        });

        await this.recordNotificationAuditEvent(notification, false);
      },
    );
  }

  async createInternalNotificationsForRoles(params: {
    roles: PrismaRole[];
    message: string;
    type?: RpcNotificationType;
    status?: RpcNotificationStatus;
    category?: NotificationPreferenceCategory;
  }): Promise<void> {
    return runInSpan(
      'NotificationService.createInternalNotificationsForRoles',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.notificationCreateInternalForRoles,
        [NotarySpanAttributes.entity]: 'Notification',
        'notification.category': params.category ?? 'assessment',
        'notification.type': formatNotificationType(params.type),
        'notification.recipient.role': params.roles.length === 1 ? params.roles[0] : 'multiple',
      },
      async (span) => {
        const userIds = await this.notificationRepository.listActiveUserIdsByRoles(params.roles);
        const enabledUserIds = await this.notificationRepository.filterUserIdsWithInAppEnabled(
          userIds,
          params.category ?? 'assessment',
        );
        setSpanAttributes(span, { 'notification.recipient_count': enabledUserIds.length });

        await this.notificationRepository.createManyNotifications({
          userIds: enabledUserIds,
          message: params.message,
          type: toPrismaType(params.type),
          status: toPrismaStatus(params.status),
        });
      },
    );
  }

  async createInternalNotificationsForRole(
    role: PrismaRole,
    params: Omit<Parameters<NotificationService['createInternalNotification']>[0], 'userId'>,
  ): Promise<void> {
    return runInSpan(
      'NotificationService.createInternalNotificationsForRole',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.notificationCreateInternalForRole,
        [NotarySpanAttributes.entity]: 'Notification',
        'notification.category': formatNotificationCategory(params.category),
        'notification.type': formatNotificationType(params.type),
        'notification.recipient.role': role,
      },
      async (span) => {
        const userIds = await this.notificationRepository.listActiveUserIdsByRoles([role]);
        const category = toPreferenceCategory(params.category);
        const enabledUserIds = await this.notificationRepository.filterUserIdsWithInAppEnabled(
          userIds,
          category,
        );
        setSpanAttributes(span, { 'notification.recipient_count': enabledUserIds.length });

        if (!enabledUserIds.length) {
          return;
        }

        const notificationType = params.type ?? RpcNotificationType.PUSH;
        enabledUserIds.forEach(() =>
          this.recordNotificationMetricsBestEffort(notificationType, params.category),
        );

        await this.notificationRepository.createManyNotifications({
          userIds: enabledUserIds,
          title: normalizeOptionalTitle(params.title),
          message: normalizeMessage(params.message),
          category: params.category ?? RpcNotificationCategory.SYSTEM,
          type: toPrismaType(params.type),
          status: toPrismaStatus(params.status),
        });

        await this.auditService.record({
          eventType: 'notification.created',
          targetType: 'notification',
          actionTitle: 'Уведомления созданы',
          actionContext: 'Массовая отправка уведомлений для роли',
          targetTitle: params.title,
          targetContext: formatNotificationCategory(params.category),
          after: {
            createdCount: enabledUserIds.length,
            type: params.type,
            category: params.category,
          },
        });
      },
    );
  }

  listNotifications(request: ListNotificationsRequest): Promise<ListNotificationsResponse> {
    validateUuid(request.userId, 'user_id');
    const currentUser = requireAuth();
    if (currentUser.sub !== request.userId) {
      throw new ConnectError(
        'access denied: can only list own notifications',
        Code.PermissionDenied,
      );
    }

    const query = {
      page: normalizePositiveInt(request.pagination?.page, DEFAULT_PAGE, 'pagination.page'),
      limit: normalizePageLimit(request.pagination?.limit),
      userId: request.userId,
      types: normalizeRepeatedEnumFilter(request.filters?.types, RpcNotificationType.UNSPECIFIED),
      statuses: normalizeRepeatedEnumFilter(
        request.filters?.statuses,
        RpcNotificationStatus.UNSPECIFIED,
      ),
      unreadOnly: request.filters?.unreadOnly ?? false,
    };

    return runInSpan(
      'NotificationService.listNotifications',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.notificationList,
        [NotarySpanAttributes.entity]: 'Notification',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(currentUser.role),
      },
      async () => this.notificationRepository.listNotifications(query),
    );
  }

  async markAsRead(request: MarkAsReadRequest): Promise<MarkAsReadResponse> {
    return runInSpan(
      'NotificationService.markAsRead',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.notificationMarkRead,
        [NotarySpanAttributes.entity]: 'Notification',
      },
      async () => {
        validateUuid(request.id, 'id');
        const { notification, updated } = await this.notificationRepository.markAsRead(request.id);

        if (updated) {
          await this.recordNotificationAuditEvent(notification, true);
        }

        return create(MarkAsReadResponseSchema, { notification });
      },
    );
  }

  async markAllAsRead(request: MarkAllAsReadRequest): Promise<MarkAllAsReadResponse> {
    validateUuid(request.userId, 'user_id');
    const currentUser = requireAuth();
    if (currentUser.sub !== request.userId) {
      throw new ConnectError(
        'access denied: can only mark own notifications',
        Code.PermissionDenied,
      );
    }

    return runInSpan(
      'NotificationService.markAllAsRead',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.notificationMarkAllRead,
        [NotarySpanAttributes.entity]: 'Notification',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(currentUser.role),
      },
      async (span) => {
        const notifications = await this.notificationRepository.markAllAsRead(request.userId);
        setSpanAttributes(span, { 'notification.updated_count': notifications.length });

        await Promise.all(
          notifications.map((notification) =>
            this.recordNotificationAuditEvent(notification, true),
          ),
        );

        return create(MarkAllAsReadResponseSchema, { updatedCount: notifications.length });
      },
    );
  }

  async deleteNotification(
    request: DeleteNotificationRequest,
  ): Promise<DeleteNotificationResponse> {
    return runInSpan(
      'NotificationService.deleteNotification',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.notificationDelete,
        [NotarySpanAttributes.entity]: 'Notification',
      },
      async () => {
        validateUuid(request.id, 'id');
        const success = await this.notificationRepository.deleteNotification(request.id);
        return create(DeleteNotificationResponseSchema, { success });
      },
    );
  }

  async getNotificationSettings(
    _request: GetNotificationSettingsRequest,
  ): Promise<GetNotificationSettingsResponse> {
    void _request;
    const currentUser = requireAuth();

    return runInSpan(
      'NotificationService.getNotificationSettings',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.notificationSettingsGet,
        [NotarySpanAttributes.entity]: 'NotificationPreference',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(currentUser.role),
      },
      async () => {
        const settings = await this.notificationRepository.getOrCreatePreferencesMatrix(
          currentUser.sub,
        );
        return create(GetNotificationSettingsResponseSchema, {
          settings,
        });
      },
    );
  }

  async updateNotificationSettings(
    request: UpdateNotificationSettingsRequest,
  ): Promise<UpdateNotificationSettingsResponse> {
    const currentUser = requireAuth();

    return runInSpan(
      'NotificationService.updateNotificationSettings',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.notificationSettingsUpdate,
        [NotarySpanAttributes.entity]: 'NotificationPreference',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(currentUser.role),
      },
      async () => {
        if (!request.settings) {
          throw new ConnectError('settings is required', Code.InvalidArgument);
        }

        const settings = await this.notificationRepository.updatePreferencesMatrix(
          currentUser.sub,
          request.settings,
        );

        return create(UpdateNotificationSettingsResponseSchema, {
          settings,
        });
      },
    );
  }

  private async recordNotificationAuditEvent(
    notification: RpcNotification,
    isRead: boolean,
  ): Promise<void> {
    const readAt = isRead
      ? notification.readAt
        ? timestampDate(notification.readAt).toISOString()
        : new Date().toISOString()
      : null;

    await this.auditService.record({
      eventType: isRead ? 'notification.read' : 'notification.created',
      targetType: 'notification',
      targetId: notification.id,
      actionTitle: isRead ? 'Уведомление прочитано' : 'Уведомление создано',
      actionContext: isRead
        ? 'Уведомление помечено как прочитанное'
        : 'Создано новое уведомление',
      targetTitle: notification.title,
      targetContext: String(notification.category),
      after: {
        status: isRead ? 'read' : 'unread',
        type: notification.type,
        category: notification.category,
        title: notification.title,
        readAt,
        sentAt: notification.sentAt
          ? timestampDate(notification.sentAt).toISOString()
          : undefined,
      },
    });
  }

  private recordNotificationMetricsBestEffort(
    type: RpcNotificationType,
    category: RpcNotificationCategory | NotificationPreferenceCategory | undefined,
  ): void {
    const channel = notificationChannelForRpcType(type);

    try {
      this.metricsService.recordNotificationSent(channel, String(category ?? 'system'));
      this.metricsService.recordNotificationUnread('user');
    } catch {
      try {
        this.metricsService.recordNotificationError(channel, 'unknown');
      } catch {
        // ignore
      }
    }
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

function notificationChannelForRpcType(type: RpcNotificationType): NotificationChannel {
  switch (type) {
    case RpcNotificationType.EMAIL:
      return 'email';
    case RpcNotificationType.SMS:
      return 'sms';
    case RpcNotificationType.PUSH:
      return 'push';
    case RpcNotificationType.IN_APP:
      return 'in_app';
    case RpcNotificationType.UNSPECIFIED:
    default:
      return 'unknown' as NotificationChannel;
  }
}

function toPrismaStatus(
  status: RpcNotificationStatus | undefined,
): PrismaNotificationStatus | undefined {
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

function toPreferenceCategory(
  category: RpcNotificationCategory | undefined,
): NotificationPreferenceCategory {
  switch (category) {
    case RpcNotificationCategory.PAYMENT:
      return 'payment';
    case RpcNotificationCategory.ASSESSMENT:
      return 'assessment';
    case RpcNotificationCategory.SYSTEM:
    case undefined:
    default:
      return 'system';
  }
}

function formatNotificationCategory(
  category: RpcNotificationCategory | NotificationPreferenceCategory | undefined,
): string {
  switch (category) {
    case RpcNotificationCategory.ASSESSMENT:
    case 'assessment':
      return 'assessment';
    case RpcNotificationCategory.PAYMENT:
    case 'payment':
      return 'payment';
    case RpcNotificationCategory.SYSTEM:
    case 'system':
    case undefined:
      return 'system';
    default:
      return 'unknown';
  }
}

function formatNotificationType(type: RpcNotificationType | undefined): string {
  switch (type) {
    case RpcNotificationType.EMAIL:
      return 'email';
    case RpcNotificationType.SMS:
      return 'sms';
    case RpcNotificationType.PUSH:
      return 'push';
    case RpcNotificationType.IN_APP:
      return 'in_app';
    case RpcNotificationType.UNSPECIFIED:
    case undefined:
    default:
      return 'unspecified';
  }
}
