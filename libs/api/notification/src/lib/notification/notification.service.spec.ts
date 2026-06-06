import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { Role, requestContextStorage, type AccessTokenPayload } from '@internal/auth-shared';
import {
  NotificationEntityCategory,
  NotificationPreferenceChannel,
  NotificationPreferenceStatus,
  NotificationStatus as PrismaNotificationStatus,
  NotificationType as PrismaNotificationType,
  Role as PrismaRole,
} from '@internal/prisma-client';
import { runInSpan } from '@internal/tracing';
import type { Span } from '@opentelemetry/api';
import {
  ListNotificationsRequestSchema,
  MarkAllAsReadRequestSchema,
  NotificationCategory as RpcNotificationCategory,
  NotificationSchema,
  NotificationStatus as RpcNotificationStatus,
  NotificationType as RpcNotificationType,
} from '@notary-portal/api-contracts';
import { NotificationService } from './notification.service';

jest.mock('@internal/tracing', () => {
  const actual = jest.requireActual<typeof import('@internal/tracing')>('@internal/tracing');
  return {
    ...actual,
    runInSpan: jest.fn(
      async (
        _spanName: string,
        _attributes: Record<string, unknown>,
        action: (span: Span) => unknown | Promise<unknown>,
      ) => action({} as Span),
    ),
    setSpanAttributes: jest.fn(),
  };
});

const USER_ID = '11111111-1111-4111-a111-111111111111';
const SECOND_USER_ID = '22222222-2222-4222-a222-222222222222';

describe('NotificationService', () => {
  const repository = {
    createNotification: jest.fn(),
    listNotifications: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    getOrCreatePreferenceRows: jest.fn(),
    listActiveUserIdsByRoles: jest.fn(),
    filterUserIdsWithInAppEnabled: jest.fn(),
    createManyNotifications: jest.fn(),
  };
  const metricsService = {
    recordNotificationSent: jest.fn(),
    recordNotificationUnread: jest.fn(),
    recordNotificationError: jest.fn(),
  };
  const metricsService = {
    recordNotificationSent: jest.fn(),
    recordNotificationUnread: jest.fn(),
    recordNotificationError: jest.fn(),
  };

  const service = new NotificationService(repository as never, metricsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.createNotification.mockResolvedValue(
      create(NotificationSchema, {
        id: 'notification-1',
        userId: USER_ID,
        title: 'Broadcast completed',
        category: RpcNotificationCategory.SYSTEM,
        type: RpcNotificationType.PUSH,
        message: 'Broadcast completed',
        sentAt: timestampFromDate(new Date('2026-05-15T10:00:00.000Z')),
        status: RpcNotificationStatus.SENT,
      }),
    );
    repository.listNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 });
    repository.markAllAsRead.mockResolvedValue(2);
    repository.getOrCreatePreferenceRows.mockResolvedValue(activePreferenceRows());
    repository.listActiveUserIdsByRoles.mockResolvedValue([USER_ID]);
    repository.filterUserIdsWithInAppEnabled.mockResolvedValue([USER_ID]);
    repository.createManyNotifications.mockResolvedValue(undefined);
  });

  it('normalizes internal notification payloads before creating them', async () => {
    await service.createNotification({
      userId: USER_ID,
      title: '  Broadcast completed  ',
      category: RpcNotificationCategory.SYSTEM,
      type: RpcNotificationType.PUSH,
      message: '  Broadcast completed  ',
    });

    expect(repository.createNotification).toHaveBeenCalledWith({
      userId: USER_ID,
      title: 'Broadcast completed',
      category: RpcNotificationCategory.SYSTEM,
      type: RpcNotificationType.PUSH,
      message: 'Broadcast completed',
      status: undefined,
      sentAt: undefined,
      readAt: undefined,
    });
    expect(metricsService.recordNotificationSent).toHaveBeenCalledWith('push', '4');
    expect(metricsService.recordNotificationUnread).toHaveBeenCalledWith('user');
  });

  it('keeps creating notifications when metrics recording fails', async () => {
    metricsService.recordNotificationSent.mockImplementationOnce(() => {
      throw new Error('metrics backend is unavailable');
    });

    await service.createNotification({
      userId: USER_ID,
      title: 'Payment update',
      category: RpcNotificationCategory.PAYMENT,
      type: RpcNotificationType.EMAIL,
      message: 'Payment was accepted',
    });

    expect(metricsService.recordNotificationError).toHaveBeenCalledWith('email', 'unknown');
    expect(repository.createNotification).toHaveBeenCalledWith({
      userId: USER_ID,
      title: 'Payment update',
      category: RpcNotificationCategory.PAYMENT,
      type: RpcNotificationType.EMAIL,
      message: 'Payment was accepted',
      status: undefined,
      sentAt: undefined,
      readAt: undefined,
    });
  });

  it('rejects invalid user ids', async () => {
    await expect(
      service.createNotification({
        userId: 'invalid-user',
        title: 'Broadcast completed',
        category: RpcNotificationCategory.SYSTEM,
        type: RpcNotificationType.PUSH,
        message: 'Broadcast completed',
      }),
    ).rejects.toMatchObject({
      code: Code.InvalidArgument,
    });
  });

  it('rejects blank notification messages', async () => {
    await expect(
      service.createNotification({
        userId: USER_ID,
        title: 'Broadcast completed',
        category: RpcNotificationCategory.SYSTEM,
        type: RpcNotificationType.PUSH,
        message: '   ',
      }),
    ).rejects.toBeInstanceOf(ConnectError);
  });

  it('keeps the main unknown-channel metric behavior for unspecified notifications', async () => {
    await service.createNotification({
      userId: USER_ID,
      type: RpcNotificationType.UNSPECIFIED,
      message: 'System notification',
    });

    expect(metricsService.recordNotificationSent).toHaveBeenCalledWith('unknown', 'system');
    expect(metricsService.recordNotificationUnread).toHaveBeenCalledWith('user');
  });

  it('creates role notifications in one aggregate span without per-recipient spans', async () => {
    const roleUserIds = [USER_ID, SECOND_USER_ID];
    repository.listActiveUserIdsByRoles.mockResolvedValueOnce(roleUserIds);
    repository.filterUserIdsWithInAppEnabled.mockResolvedValueOnce(roleUserIds);

    await service.createInternalNotificationsForRole(PrismaRole.Admin, {
      message: 'New application',
      category: RpcNotificationCategory.ASSESSMENT,
      type: RpcNotificationType.IN_APP,
    });

    expect(runInSpan).toHaveBeenCalledTimes(1);
    expect(repository.filterUserIdsWithInAppEnabled).toHaveBeenCalledWith(
      roleUserIds,
      'assessment',
    );
    expect(repository.createNotification).not.toHaveBeenCalled();
    expect(repository.createManyNotifications).toHaveBeenCalledWith({
      userIds: roleUserIds,
      title: undefined,
      message: 'New application',
      category: RpcNotificationCategory.ASSESSMENT,
      type: PrismaNotificationType.InApp,
      status: undefined,
    });
    expect(metricsService.recordNotificationSent).toHaveBeenCalledTimes(2);
  });

  it('keeps the existing multi-role bulk payload and metric behavior', async () => {
    const roleUserIds = [USER_ID, SECOND_USER_ID];
    repository.listActiveUserIdsByRoles.mockResolvedValueOnce(roleUserIds);
    repository.filterUserIdsWithInAppEnabled.mockResolvedValueOnce(roleUserIds);

    await service.createInternalNotificationsForRoles({
      roles: [PrismaRole.Admin, PrismaRole.Notary],
      message: 'System message',
      category: 'assessment',
      type: RpcNotificationType.IN_APP,
    });

    expect(runInSpan).toHaveBeenCalledTimes(1);
    expect(repository.createNotification).not.toHaveBeenCalled();
    expect(repository.createManyNotifications).toHaveBeenCalledWith({
      userIds: roleUserIds,
      message: 'System message',
      type: PrismaNotificationType.InApp,
      status: undefined,
    });
    expect(metricsService.recordNotificationSent).not.toHaveBeenCalled();
  });

  it('does not claim an actor role for operations without an authorization check', async () => {
    repository.markAsRead.mockResolvedValue(
      create(NotificationSchema, {
        id: '33333333-3333-4333-a333-333333333333',
        userId: USER_ID,
        title: 'Notification',
        type: RpcNotificationType.PUSH,
        message: 'System notification',
        sentAt: timestampFromDate(new Date('2026-05-15T10:00:00.000Z')),
        status: RpcNotificationStatus.SENT,
      }),
    );

    await runAsCurrentUser(() =>
      service.markAsRead({ id: '33333333-3333-4333-a333-333333333333' } as never),
    );

    const attributes = jest.mocked(runInSpan).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(attributes).not.toHaveProperty('notary.actor.role');
  });

  it('records actor role only after mark-all authorization succeeds', async () => {
    await runAsCurrentUser(() => service.markAllAsRead({ userId: USER_ID } as never));

    expect(runInSpan).toHaveBeenCalledWith(
      'NotificationService.markAllAsRead',
      expect.objectContaining({
        'notary.actor.role': 'applicant',
      }),
      expect.any(Function),
    );
  });

  it('normalizes list pagination and compact enum filters', async () => {
    await runAsCurrentUser(() =>
      service.listNotifications(
        create(ListNotificationsRequestSchema, {
          userId: USER_ID,
          pagination: {
            page: 2,
            limit: 100,
          },
          filters: {
            types: [
              RpcNotificationType.PUSH,
              RpcNotificationType.UNSPECIFIED,
              RpcNotificationType.PUSH,
            ],
            statuses: [
              RpcNotificationStatus.SENT,
              RpcNotificationStatus.UNSPECIFIED,
              RpcNotificationStatus.SENT,
            ],
            unreadOnly: true,
          },
        }),
      ),
    );

    expect(repository.listNotifications).toHaveBeenCalledWith({
      page: 2,
      limit: 100,
      userId: USER_ID,
      types: [RpcNotificationType.PUSH],
      statuses: [RpcNotificationStatus.SENT],
      unreadOnly: true,
    });
  });

  it('uses stable list defaults when pagination fields are omitted', async () => {
    await runAsCurrentUser(() =>
      service.listNotifications(
        create(ListNotificationsRequestSchema, {
          userId: USER_ID,
        }),
      ),
    );

    expect(repository.listNotifications).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      userId: USER_ID,
      types: undefined,
      statuses: undefined,
      unreadOnly: false,
    });
  });

  it('rejects listing notifications for another user', () => {
    expect(() =>
      runAs(otherNotificationUser(), () =>
        service.listNotifications(
          create(ListNotificationsRequestSchema, {
            userId: USER_ID,
          }),
        ),
      ),
    ).toThrow(
      expect.objectContaining({
        code: Code.PermissionDenied,
      }),
    );
    expect(repository.listNotifications).not.toHaveBeenCalled();
  });

  it('marks all notifications as read for the current user', async () => {
    const response = await runAsCurrentUser(() =>
      service.markAllAsRead(
        create(MarkAllAsReadRequestSchema, {
          userId: USER_ID,
        }),
      ),
    );

    expect(repository.markAllAsRead).toHaveBeenCalledWith(USER_ID);
    expect(response.updatedCount).toBe(2);
  });

  it('rejects marking another user notifications as read', async () => {
    await expect(
      runAs(otherNotificationUser(), () =>
        service.markAllAsRead(
          create(MarkAllAsReadRequestSchema, {
            userId: USER_ID,
          }),
        ),
      ),
    ).rejects.toMatchObject({
      code: Code.PermissionDenied,
    });
    expect(repository.markAllAsRead).not.toHaveBeenCalled();
  });

  it('rejects unsafe pagination values', async () => {
    expect(() =>
      runAsCurrentUser(() =>
        service.listNotifications(
          create(ListNotificationsRequestSchema, {
            userId: USER_ID,
            pagination: {
              page: -1,
              limit: 10,
            },
          }),
        ),
      ),
    ).toThrow(ConnectError);

    expect(() =>
      runAsCurrentUser(() =>
        service.listNotifications(
          create(ListNotificationsRequestSchema, {
            userId: USER_ID,
            pagination: {
              page: 1,
              limit: 101,
            },
          }),
        ),
      ),
    ).toThrow(ConnectError);
  });

  it('skips internal in-app notifications disabled by preferences', async () => {
    repository.getOrCreatePreferenceRows.mockResolvedValueOnce(
      inactivePreferenceRows(NotificationEntityCategory.System),
    );

    await service.createInternalNotification({
      userId: USER_ID,
      category: RpcNotificationCategory.SYSTEM,
      message: 'System notification',
    });

    expect(repository.getOrCreatePreferenceRows).toHaveBeenCalledWith(USER_ID);
    expect(repository.createNotification).not.toHaveBeenCalled();
    expect(metricsService.recordNotificationSent).not.toHaveBeenCalled();
  });

  it('uses system preferences for default internal notification categories', async () => {
    repository.getOrCreatePreferenceRows.mockResolvedValueOnce(
      inactivePreferenceRows(NotificationEntityCategory.System),
    );

    await service.createInternalNotification({
      userId: USER_ID,
      message: 'Default system notification',
    });

    expect(repository.getOrCreatePreferenceRows).toHaveBeenCalledWith(USER_ID);
    expect(repository.createNotification).not.toHaveBeenCalled();
    expect(metricsService.recordNotificationSent).not.toHaveBeenCalled();
  });

  it('creates internal notifications when in-app preferences are active', async () => {
    await service.createInternalNotification({
      userId: USER_ID,
      title: '  Internal notice  ',
      category: RpcNotificationCategory.SYSTEM,
      message: '  System notification  ',
    });

    expect(repository.createNotification).toHaveBeenCalledWith({
      userId: USER_ID,
      title: 'Internal notice',
      category: RpcNotificationCategory.SYSTEM,
      message: 'System notification',
      type: RpcNotificationType.PUSH,
      status: RpcNotificationStatus.SENT,
    });
    expect(metricsService.recordNotificationSent).toHaveBeenCalledWith('push', '4');
    expect(metricsService.recordNotificationUnread).toHaveBeenCalledWith('user');
  });

  it('creates role notifications only for users with active in-app preferences', async () => {
    const roleUserIds = [USER_ID, '33333333-3333-4333-a333-333333333333'];
    const enabledUserIds = [roleUserIds[1]];
    repository.listActiveUserIdsByRoles.mockResolvedValueOnce(roleUserIds);
    repository.filterUserIdsWithInAppEnabled.mockResolvedValueOnce(enabledUserIds);

    await service.createInternalNotificationsForRoles({
      roles: [PrismaRole.Applicant, PrismaRole.Notary],
      category: 'payment',
      message: 'Payment status changed',
      type: RpcNotificationType.IN_APP,
      status: RpcNotificationStatus.PENDING,
    });

    expect(repository.listActiveUserIdsByRoles).toHaveBeenCalledWith([
      PrismaRole.Applicant,
      PrismaRole.Notary,
    ]);
    expect(repository.filterUserIdsWithInAppEnabled).toHaveBeenCalledWith(
      roleUserIds,
      'payment',
    );
    expect(repository.createManyNotifications).toHaveBeenCalledWith({
      userIds: enabledUserIds,
      message: 'Payment status changed',
      type: PrismaNotificationType.InApp,
      status: PrismaNotificationStatus.Pending,
    });
  });

  it('uses assessment preferences and repository defaults for compact role notifications', async () => {
    await service.createInternalNotificationsForRoles({
      roles: [PrismaRole.Admin],
      message: 'Assessment needs attention',
    });

    expect(repository.listActiveUserIdsByRoles).toHaveBeenCalledWith([PrismaRole.Admin]);
    expect(repository.filterUserIdsWithInAppEnabled).toHaveBeenCalledWith(
      [USER_ID],
      'assessment',
    );
    expect(repository.createManyNotifications).toHaveBeenCalledWith({
      userIds: [USER_ID],
      message: 'Assessment needs attention',
      type: undefined,
      status: undefined,
    });
  });
});

function notificationUser(): AccessTokenPayload {
  return {
    sub: USER_ID,
    email: 'user@example.com',
    role: Role.Applicant,
    iat: 1,
    exp: 2,
  };
}

function otherNotificationUser(): AccessTokenPayload {
  return {
    ...notificationUser(),
    sub: SECOND_USER_ID,
    email: 'other@example.com',
  };
}

function runAsCurrentUser<T>(callback: () => T): T {
  return runAs(notificationUser(), callback);
}

function runAs<T>(user: AccessTokenPayload, callback: () => T): T {
  return requestContextStorage.run(
    {
      user,
      metadata: { ip: null, userAgent: null },
    },
    callback,
  );
}

function activePreferenceRows() {
  return [
    preferenceRow(NotificationEntityCategory.System, NotificationPreferenceStatus.Active),
    preferenceRow(NotificationEntityCategory.Assessment, NotificationPreferenceStatus.Active),
    preferenceRow(NotificationEntityCategory.Payment, NotificationPreferenceStatus.Active),
  ];
}

function inactivePreferenceRows(category: NotificationEntityCategory) {
  return [preferenceRow(category, NotificationPreferenceStatus.Inactive)];
}

function preferenceRow(
  entityCategory: NotificationEntityCategory,
  status: NotificationPreferenceStatus,
) {
  return {
    id: `${entityCategory}-${status}`,
    userId: USER_ID,
    channel: NotificationPreferenceChannel.InApp,
    entityCategory,
    status,
    updatedAt: new Date('2026-05-15T10:00:00.000Z'),
  };
}
