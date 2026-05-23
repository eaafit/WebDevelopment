import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import {
  ListNotificationsResponseSchema,
  NotificationCategory,
  NotificationSchema,
  NotificationStatus,
  NotificationType,
  PaginationMetaSchema,
} from '@notary-portal/api-contracts';
import {
  toNotificationCenterItem,
  toNotificationCenterPage,
} from './notification-center-api.service';

describe('NotificationCenterApiService mappers', () => {
  it('maps explicit API title, category and in-app channel', () => {
    const sentAt = new Date('2026-05-15T10:00:00.000Z');

    const item = toNotificationCenterItem(
      create(NotificationSchema, {
        id: 'notification-1',
        userId: 'user-1',
        title: 'Assessment is ready',
        category: NotificationCategory.ASSESSMENT,
        type: NotificationType.IN_APP,
        message: 'Open the assessment details.',
        sentAt: timestampFromDate(sentAt),
        status: NotificationStatus.SENT,
      }),
    );

    expect(item).toEqual(
      expect.objectContaining({
        id: 'notification-1',
        title: 'Assessment is ready',
        description: 'Open the assessment details.',
        createdAt: sentAt.toISOString(),
        type: 'assessment',
        channel: 'in-app',
        lifecycle: 'sent',
      }),
    );
  });

  it('keeps read lifecycle above delivery status', () => {
    const item = toNotificationCenterItem(
      create(NotificationSchema, {
        id: 'notification-2',
        userId: 'user-1',
        category: NotificationCategory.PAYMENT,
        type: NotificationType.EMAIL,
        message: 'Payment failed.',
        sentAt: timestampFromDate(new Date('2026-05-15T10:00:00.000Z')),
        readAt: timestampFromDate(new Date('2026-05-15T10:05:00.000Z')),
        status: NotificationStatus.FAILED,
      }),
    );

    expect(item.type).toBe('payment');
    expect(item.channel).toBe('email');
    expect(item.lifecycle).toBe('read');
  });

  it('maps pagination metadata with transformed items', () => {
    const page = toNotificationCenterPage(
      create(ListNotificationsResponseSchema, {
        notifications: [
          create(NotificationSchema, {
            id: 'notification-3',
            userId: 'user-1',
            category: NotificationCategory.SYSTEM,
            type: NotificationType.PUSH,
            message: 'System notification.',
            status: NotificationStatus.PENDING,
          }),
        ],
        meta: create(PaginationMetaSchema, {
          totalItems: 7,
          totalPages: 2,
          currentPage: 1,
          perPage: 5,
        }),
        unreadCount: 4,
      }),
    );

    expect(page.totalItems).toBe(7);
    expect(page.unreadCount).toBe(4);
    expect(page.notifications[0]).toEqual(
      expect.objectContaining({
        id: 'notification-3',
        type: 'system',
        channel: 'push',
        lifecycle: 'created',
      }),
    );
  });
});
