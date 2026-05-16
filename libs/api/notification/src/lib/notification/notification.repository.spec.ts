import {
  NotificationCategory as RpcNotificationCategory,
  NotificationStatus as RpcNotificationStatus,
  NotificationType as RpcNotificationType,
} from '@notary-portal/api-contracts';
import {
  NotificationCategory as PrismaNotificationCategory,
  NotificationStatus as PrismaNotificationStatus,
  NotificationType as PrismaNotificationType,
} from '@internal/prisma-client';
import { NotificationRepository } from './notification.repository';

describe('NotificationRepository', () => {
  const createNotification = jest.fn();
  const prisma = {
    notification: {
      create: createNotification,
    },
    user: {
      findMany: jest.fn(),
    },
  };

  const repository = new NotificationRepository(prisma as never);

  beforeEach(() => {
    createNotification.mockReset();
    createNotification.mockResolvedValue(
      {
        id: 'notification-1',
        userId: '11111111-1111-4111-a111-111111111111',
        title: 'Рассылка завершена',
        type: PrismaNotificationType.Push,
        category: PrismaNotificationCategory.System,
        message: 'Рассылка завершена',
        sentAt: new Date('2026-05-15T10:00:00.000Z'),
        status: PrismaNotificationStatus.Sent,
        readAt: null,
      } as never,
    );
  });

  it('creates internal notifications with sent defaults', async () => {
    const result = await repository.createNotification({
      userId: '11111111-1111-4111-a111-111111111111',
      title: 'Рассылка завершена',
      category: RpcNotificationCategory.SYSTEM,
      type: RpcNotificationType.PUSH,
      message: 'Рассылка завершена',
    });

    expect(createNotification).toHaveBeenCalledWith({
      data: {
        userId: '11111111-1111-4111-a111-111111111111',
        title: 'Рассылка завершена',
        type: PrismaNotificationType.Push,
        category: PrismaNotificationCategory.System,
        message: 'Рассылка завершена',
        status: PrismaNotificationStatus.Sent,
        sentAt: expect.any(Date),
      },
    });
    expect(result).toMatchObject({
      userId: '11111111-1111-4111-a111-111111111111',
      title: 'Рассылка завершена',
      category: RpcNotificationCategory.SYSTEM,
      message: 'Рассылка завершена',
      type: RpcNotificationType.PUSH,
      status: RpcNotificationStatus.SENT,
    });
  });
});
