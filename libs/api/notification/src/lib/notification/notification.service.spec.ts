import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { Role, requestContextStorage, type AccessTokenPayload } from '@internal/auth-shared';
import {
  ListNotificationsRequestSchema,
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
  };

  const service = new NotificationService(repository as never);

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
        userId: '11111111-1111-4111-a111-111111111111',
        title: 'Рассылка завершена',
        category: RpcNotificationCategory.SYSTEM,
        type: RpcNotificationType.PUSH,
        message: '   ',
      }),
    ).rejects.toBeInstanceOf(ConnectError);
  });

  it('normalizes list pagination and compact enum filters', async () => {
    await runAs(
      notificationUser(),
      () =>
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
    await runAs(
      notificationUser(),
      () =>
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

  it('rejects unsafe pagination values', async () => {
    expect(() =>
      runAs(notificationUser(), () =>
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
      runAs(notificationUser(), () =>
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

function runAs<T>(user: AccessTokenPayload, callback: () => T): T {
  return requestContextStorage.run(
    {
      user,
      metadata: { ip: null, userAgent: null },
    },
    callback,
  );
}
