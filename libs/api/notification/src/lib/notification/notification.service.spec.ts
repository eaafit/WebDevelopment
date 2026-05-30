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
import {
  ListNotificationsRequestSchema,
  MarkAllAsReadRequestSchema,
  NotificationCategory as RpcNotificationCategory,
  NotificationSchema,
  NotificationStatus as RpcNotificationStatus,
  NotificationType as RpcNotificationType,
} from '@notary-portal/api-contracts';
import { NotificationService } from './notification.service';

const USER_ID = '11111111-1111-4111-a111-111111111111';

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

  const service = new NotificationService(repository as never, metricsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.createNotification.mockResolvedValue(
      create(NotificationSchema, {
        id: 'notification-1',
        userId: USER_ID,
        title: 'Рассылка завершена',
        category: RpcNotificationCategory.SYSTEM,
        type: RpcNotificationType.PUSH,
        message: 'Рассылка завершена',
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
      title: '  Рассылка завершена  ',
      category: RpcNotificationCategory.SYSTEM,
      type: RpcNotificationType.PUSH,
      message: '  Рассылка завершена  ',
    });

    expect(repository.createNotification).toHaveBeenCalledWith({
      userId: USER_ID,
      title: 'Рассылка завершена',
      category: RpcNotificationCategory.SYSTEM,
      type: RpcNotificationType.PUSH,
      message: 'Рассылка завершена',
      status: undefined,
      sentAt: undefined,
      readAt: undefined,
    });
    expect(metricsService.recordNotificationSent).toHaveBeenCalledWith('push', '4');
    expect(metricsService.recordNotificationUnread).toHaveBeenCalledWith('user');
  });

  it('rejects invalid user ids', async () => {
    await expect(
      service.createNotification({
        userId: 'invalid-user',
        title: 'Рассылка завершена',
        category: RpcNotificationCategory.SYSTEM,
        type: RpcNotificationType.PUSH,
        message: 'Рассылка завершена',
      }),
    ).rejects.toMatchObject({
      code: Code.InvalidArgument,
    });
  });

  it('rejects blank notification messages', async () => {
    await expect(
      service.createNotification({
        userId: USER_ID,
        title: 'Рассылка завершена',
        category: RpcNotificationCategory.SYSTEM,
        type: RpcNotificationType.PUSH,
        message: '   ',
      }),
    ).rejects.toBeInstanceOf(ConnectError);
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

  it('fans out single-role notifications through individual preference checks', async () => {
    const roleUserIds = [USER_ID, '44444444-4444-4444-a444-444444444444'];
    repository.listActiveUserIdsByRoles.mockResolvedValueOnce(roleUserIds);

    await service.createInternalNotificationsForRole(PrismaRole.Notary, {
      category: RpcNotificationCategory.ASSESSMENT,
      message: 'Assessment report is ready',
    });

    expect(repository.listActiveUserIdsByRoles).toHaveBeenCalledWith([PrismaRole.Notary]);
    expect(repository.getOrCreatePreferenceRows).toHaveBeenCalledTimes(roleUserIds.length);
    expect(repository.createNotification).toHaveBeenCalledTimes(roleUserIds.length);
    expect(repository.createNotification).toHaveBeenNthCalledWith(1, {
      userId: roleUserIds[0],
      title: undefined,
      category: RpcNotificationCategory.ASSESSMENT,
      message: 'Assessment report is ready',
      type: RpcNotificationType.PUSH,
      status: RpcNotificationStatus.SENT,
    });
    expect(repository.createNotification).toHaveBeenNthCalledWith(2, {
      userId: roleUserIds[1],
      title: undefined,
      category: RpcNotificationCategory.ASSESSMENT,
      message: 'Assessment report is ready',
      type: RpcNotificationType.PUSH,
      status: RpcNotificationStatus.SENT,
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
    sub: '22222222-2222-4222-a222-222222222222',
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
