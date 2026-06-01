import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  ListNotificationsRequestSchema,
  MarkAllAsReadRequestSchema,
  MarkAsReadRequestSchema,
  NotificationCategory as RpcNotificationCategory,
  NotificationSchema,
  NotificationStatus as RpcNotificationStatus,
  NotificationType as RpcNotificationType,
} from '@notary-portal/api-contracts';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  const repository = {
    createNotification: jest.fn(),
    listNotifications: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
  };
  const metricsService = {
    recordNotificationSent: jest.fn(),
    recordNotificationUnread: jest.fn(),
    recordNotificationError: jest.fn(),
  };
  const auditService = {
    record: jest.fn(),
  };

  const service = new NotificationService(
    repository as never,
    metricsService as never,
    auditService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.createNotification.mockResolvedValue(
      create(NotificationSchema, {
        id: 'notification-1',
        userId: '11111111-1111-4111-a111-111111111111',
        title: 'Рассылка завершена',
        category: RpcNotificationCategory.SYSTEM,
        type: RpcNotificationType.PUSH,
        message: 'Рассылка завершена',
        sentAt: timestampFromDate(new Date('2026-05-15T10:00:00.000Z')),
        status: RpcNotificationStatus.SENT,
      }),
    );
    repository.listNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 });
    metricsService.recordNotificationSent.mockResolvedValue(undefined);
    metricsService.recordNotificationUnread.mockResolvedValue(undefined);
    metricsService.recordNotificationError.mockResolvedValue(undefined);
    auditService.record.mockResolvedValue(undefined);
  });

  it('normalizes internal notification payloads before creating them', async () => {
    await service.createNotification({
      userId: '11111111-1111-4111-a111-111111111111',
      title: '  Рассылка завершена  ',
      category: RpcNotificationCategory.SYSTEM,
      type: RpcNotificationType.PUSH,
      message: '  Рассылка завершена  ',
    });

    expect(repository.createNotification).toHaveBeenCalledWith({
      userId: '11111111-1111-4111-a111-111111111111',
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
    await service.listNotifications(
      create(ListNotificationsRequestSchema, {
        userId: '11111111-1111-4111-a111-111111111111',
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
    );

    expect(repository.listNotifications).toHaveBeenCalledWith({
      page: 2,
      limit: 100,
      userId: '11111111-1111-4111-a111-111111111111',
      types: [RpcNotificationType.PUSH],
      statuses: [RpcNotificationStatus.SENT],
      unreadOnly: true,
    });
  });

  it('uses stable list defaults when pagination fields are omitted', async () => {
    await service.listNotifications(
      create(ListNotificationsRequestSchema, {
        userId: '11111111-1111-4111-a111-111111111111',
      }),
    );

    expect(repository.listNotifications).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      userId: '11111111-1111-4111-a111-111111111111',
      types: undefined,
      statuses: undefined,
      unreadOnly: false,
    });
  });

  it('records an audit event when a notification is created', async () => {
    await service.createNotification({
      userId: '11111111-1111-4111-a111-111111111111',
      title: '  Рассылка завершена  ',
      category: RpcNotificationCategory.SYSTEM,
      type: RpcNotificationType.PUSH,
      message: '  Рассылка завершена  ',
    });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'notification.created',
        targetType: 'notification',
        targetId: 'notification-1',
        actionTitle: 'Уведомление создано',
        after: expect.objectContaining({ status: 'unread' }),
      }),
    );
  });

  it('records an audit event when an internal notification is created', async () => {
    repository.getOrCreatePreferenceRows = jest.fn().mockResolvedValue([]);
    repository.createNotification.mockResolvedValue(
      create(NotificationSchema, {
        id: 'notification-2',
        userId: '11111111-1111-4111-a111-111111111111',
        title: 'Внутреннее уведомление',
        category: RpcNotificationCategory.SYSTEM,
        type: RpcNotificationType.IN_APP,
        message: 'У вас новое сообщение',
        sentAt: timestampFromDate(new Date('2026-05-15T12:00:00.000Z')),
        status: RpcNotificationStatus.SENT,
      }),
    );

    await service.createInternalNotification({
      userId: '11111111-1111-4111-a111-111111111111',
      title: 'Внутреннее уведомление',
      category: RpcNotificationCategory.SYSTEM,
      type: RpcNotificationType.IN_APP,
      message: 'У вас новое сообщение',
    });

    expect(repository.createNotification).toHaveBeenCalledWith({
      userId: '11111111-1111-4111-a111-111111111111',
      title: 'Внутреннее уведомление',
      category: RpcNotificationCategory.SYSTEM,
      message: 'У вас новое сообщение',
      type: RpcNotificationType.IN_APP,
      status: RpcNotificationStatus.SENT,
      sentAt: undefined,
      readAt: undefined,
    });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'notification.created',
        targetType: 'notification',
        targetId: 'notification-2',
        actionTitle: 'Уведомление создано',
        after: expect.objectContaining({ status: 'unread' }),
      }),
    );
  });

  it('records an audit event when a notification is marked as read', async () => {
    repository.markAsRead.mockResolvedValue({
      notification: create(NotificationSchema, {
        id: 'notification-1',
        userId: '11111111-1111-4111-a111-111111111111',
        title: 'Рассылка завершена',
        category: RpcNotificationCategory.SYSTEM,
        type: RpcNotificationType.PUSH,
        message: 'Рассылка завершена',
        sentAt: timestampFromDate(new Date('2026-05-15T10:00:00.000Z')),
        status: RpcNotificationStatus.SENT,
        readAt: timestampFromDate(new Date('2026-05-15T11:00:00.000Z')),
      }),
      updated: true,
    });

    await service.markAsRead(
      create(MarkAsReadRequestSchema, { id: 'notification-1' }),
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'notification.read',
        targetType: 'notification',
        targetId: 'notification-1',
        actionTitle: 'Уведомление прочитано',
        after: expect.objectContaining({ status: 'read' }),
      }),
    );
  });

  it('records a bulk audit event when markAllAsRead updates notifications', async () => {
    repository.markAllAsRead.mockResolvedValue([
      create(NotificationSchema, {
        id: 'notification-1',
        userId: '11111111-1111-4111-a111-111111111111',
        title: 'Рассылка завершена',
        category: RpcNotificationCategory.SYSTEM,
        type: RpcNotificationType.PUSH,
        message: 'Рассылка завершена',
        sentAt: timestampFromDate(new Date('2026-05-15T10:00:00.000Z')),
        status: RpcNotificationStatus.SENT,
        readAt: timestampFromDate(new Date('2026-05-15T11:00:00.000Z')),
      }),
    ]);

    const response = await service.markAllAsRead(
      create(MarkAllAsReadRequestSchema, {
        userId: '11111111-1111-4111-a111-111111111111',
      }),
    );

    expect(response.updatedCount).toBe(1);
    expect(auditService.record).toHaveBeenCalledTimes(1);
  });

  it('rejects unsafe pagination values', async () => {
    expect(() =>
      service.listNotifications(
        create(ListNotificationsRequestSchema, {
          userId: '11111111-1111-4111-a111-111111111111',
          pagination: {
            page: -1,
            limit: 10,
          },
        }),
      ),
    ).toThrow(ConnectError);

    expect(() =>
      service.listNotifications(
        create(ListNotificationsRequestSchema, {
          userId: '11111111-1111-4111-a111-111111111111',
          pagination: {
            page: 1,
            limit: 101,
          },
        }),
      ),
    ).toThrow(ConnectError);
  });
});
