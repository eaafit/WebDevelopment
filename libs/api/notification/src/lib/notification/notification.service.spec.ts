import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import {
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

  const service = new NotificationService(repository as never);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.createNotification.mockResolvedValue(
      create(NotificationSchema, {
        id: 'notification-1',
        userId: '11111111-1111-4111-a111-111111111111',
        type: RpcNotificationType.PUSH,
        message: 'Рассылка завершена',
        sentAt: timestampFromDate(new Date('2026-05-15T10:00:00.000Z')),
        status: RpcNotificationStatus.SENT,
      }),
    );
  });

  it('normalizes internal notification payloads before creating them', async () => {
    await service.createNotification({
      userId: '11111111-1111-4111-a111-111111111111',
      type: RpcNotificationType.PUSH,
      message: '  Рассылка завершена  ',
    });

    expect(repository.createNotification).toHaveBeenCalledWith({
      userId: '11111111-1111-4111-a111-111111111111',
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
        type: RpcNotificationType.PUSH,
        message: '   ',
      }),
    ).rejects.toBeInstanceOf(ConnectError);
  });
});
