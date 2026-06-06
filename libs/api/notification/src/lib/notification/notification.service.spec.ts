import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { requestContextStorage } from '@internal/auth-shared';
import { Role as PrismaRole } from '@internal/prisma-client';
import { runInSpan } from '@internal/tracing';
import type { Span } from '@opentelemetry/api';
import {
  ListNotificationsRequestSchema,
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

function runAsCurrentUser<T>(callback: () => T): T {
  return requestContextStorage.run(
    {
      user: {
        sub: USER_ID,
        email: 'applicant@example.com',
        role: 'USER_ROLE_APPLICANT',
        iat: 0,
        exp: 0,
      },
      metadata: {
        ip: null,
        userAgent: null,
      },
    },
    callback,
  );
}

describe('NotificationService', () => {
  const repository = {
    createNotification: jest.fn(),
    listNotifications: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
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
        title: 'Рассылка завершена',
        category: RpcNotificationCategory.SYSTEM,
        type: RpcNotificationType.PUSH,
        message: 'Рассылка завершена',
        sentAt: timestampFromDate(new Date('2026-05-15T10:00:00.000Z')),
        status: RpcNotificationStatus.SENT,
      }),
    );
    repository.listNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 });
    repository.listActiveUserIdsByRoles.mockResolvedValue([USER_ID, '22222222-2222-4222-a222-222222222222']);
    repository.filterUserIdsWithInAppEnabled.mockResolvedValue([
      USER_ID,
      '22222222-2222-4222-a222-222222222222',
    ]);
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

  it('keeps the main unknown-channel metric behavior for unspecified notifications', async () => {
    await service.createNotification({
      userId: USER_ID,
      type: RpcNotificationType.UNSPECIFIED,
      message: 'Системное уведомление',
    });

    expect(metricsService.recordNotificationSent).toHaveBeenCalledWith('unknown', 'system');
    expect(metricsService.recordNotificationUnread).toHaveBeenCalledWith('user');
  });

  it('creates role notifications in one aggregate span without per-recipient spans', async () => {
    await service.createInternalNotificationsForRole(PrismaRole.Admin, {
      message: 'Новая заявка',
      category: RpcNotificationCategory.ASSESSMENT,
      type: RpcNotificationType.IN_APP,
    });

    expect(runInSpan).toHaveBeenCalledTimes(1);
    expect(repository.createNotification).not.toHaveBeenCalled();
    expect(repository.createManyNotifications).toHaveBeenCalledWith({
      userIds: [USER_ID, '22222222-2222-4222-a222-222222222222'],
      title: undefined,
      message: 'Новая заявка',
      category: RpcNotificationCategory.ASSESSMENT,
      type: 'InApp',
      status: undefined,
    });
    expect(metricsService.recordNotificationSent).toHaveBeenCalledTimes(2);
  });

  it('keeps the existing multi-role bulk payload and metric behavior', async () => {
    await service.createInternalNotificationsForRoles({
      roles: [PrismaRole.Admin, PrismaRole.Notary],
      message: 'Системное сообщение',
      category: 'assessment',
      type: RpcNotificationType.IN_APP,
    });

    expect(runInSpan).toHaveBeenCalledTimes(1);
    expect(repository.createNotification).not.toHaveBeenCalled();
    expect(repository.createManyNotifications).toHaveBeenCalledWith({
      userIds: [USER_ID, '22222222-2222-4222-a222-222222222222'],
      message: 'Системное сообщение',
      type: 'InApp',
      status: undefined,
    });
    expect(metricsService.recordNotificationSent).not.toHaveBeenCalled();
  });

  it('does not claim an actor role for operations without an authorization check', async () => {
    repository.markAsRead.mockResolvedValue(
      create(NotificationSchema, {
        id: '33333333-3333-4333-a333-333333333333',
        userId: USER_ID,
        title: 'Уведомление',
        type: RpcNotificationType.PUSH,
        message: 'Системное уведомление',
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
    repository.markAllAsRead.mockResolvedValue(2);

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
});
