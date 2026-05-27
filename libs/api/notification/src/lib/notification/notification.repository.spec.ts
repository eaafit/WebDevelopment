import { Code } from '@connectrpc/connect';
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
  const findUnique = jest.fn();
  const update = jest.fn();
  const deleteMany = jest.fn();
  const prisma = {
    notification: {
      create: createNotification,
      findUnique,
      update,
      deleteMany,
    },
    user: {
      findMany: jest.fn(),
    },
  };

  const repository = new NotificationRepository(prisma as never);

  beforeEach(() => {
    createNotification.mockReset();
    findUnique.mockReset();
    update.mockReset();
    deleteMany.mockReset();

    createNotification.mockResolvedValue(notificationRecord() as never);
    update.mockResolvedValue(notificationRecord({ readAt: new Date('2026-05-15T11:00:00.000Z') }));
    deleteMany.mockResolvedValue({ count: 1 });
  });

  it('creates internal notifications with sent defaults', async () => {
    const result = await repository.createNotification({
      userId: '11111111-1111-4111-a111-111111111111',
      title: 'Payment created',
      category: RpcNotificationCategory.SYSTEM,
      type: RpcNotificationType.PUSH,
      message: 'Payment created',
    });

    expect(createNotification).toHaveBeenCalledWith({
      data: {
        userId: '11111111-1111-4111-a111-111111111111',
        title: 'Payment created',
        type: PrismaNotificationType.Push,
        category: PrismaNotificationCategory.System,
        message: 'Payment created',
        status: PrismaNotificationStatus.Sent,
        sentAt: expect.any(Date),
      },
    });
    expect(result).toMatchObject({
      userId: '11111111-1111-4111-a111-111111111111',
      title: 'Payment created',
      category: RpcNotificationCategory.SYSTEM,
      message: 'Payment created',
      type: RpcNotificationType.PUSH,
      status: RpcNotificationStatus.SENT,
    });
  });

  it('marks unread notification as read', async () => {
    findUnique.mockResolvedValue(notificationRecord({ readAt: null }));

    const result = await repository.markAsRead('notification-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
      data: { readAt: expect.any(Date) },
    });
    expect(result).toMatchObject({
      id: 'notification-1',
      status: RpcNotificationStatus.SENT,
    });
  });

  it('keeps existing read timestamp when notification is already read', async () => {
    const readAt = new Date('2026-05-15T10:30:00.000Z');
    findUnique.mockResolvedValue(notificationRecord({ readAt }));

    const result = await repository.markAsRead('notification-1');

    expect(update).not.toHaveBeenCalled();
    expect(result.readAt).toBeDefined();
  });

  it('returns a clear not found error when marking a missing notification', async () => {
    findUnique.mockResolvedValue(null);

    await expect(repository.markAsRead('missing-notification')).rejects.toMatchObject({
      code: Code.NotFound,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('returns delete result without throwing for stale ids', async () => {
    await expect(repository.deleteNotification('notification-1')).resolves.toBe(true);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'notification-1' } });

    deleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(repository.deleteNotification('already-deleted')).resolves.toBe(false);
  });
});

function notificationRecord(
  overrides: { readAt?: Date | null; title?: string; message?: string } = {},
) {
  return {
    id: 'notification-1',
    userId: '11111111-1111-4111-a111-111111111111',
    title: 'Payment created',
    type: PrismaNotificationType.Push,
    category: PrismaNotificationCategory.System,
    message: 'Payment created',
    sentAt: new Date('2026-05-15T10:00:00.000Z'),
    status: PrismaNotificationStatus.Sent,
    readAt: null,
    ...overrides,
  };
}
