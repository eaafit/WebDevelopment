export type NotificationReadFilter = 'all' | 'unread' | 'read';

export type NotificationTypeFilter = 'all' | 'application' | 'document' | 'payment' | 'system';

export type NotificationChannelFilter = 'all' | 'in-app' | 'email' | 'push';

export interface NotificationInboxFilters {
  type: NotificationTypeFilter;
  channel: NotificationChannelFilter;
  status: NotificationReadFilter;
}

export interface UiInAppNotification {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  isUnread: boolean;
  type: Exclude<NotificationTypeFilter, 'all'>;
  channel: Exclude<NotificationChannelFilter, 'all'>;
}

export interface UiAuditNotificationSource {
  id: string;
  eventType: string;
  actionTitle: string;
  actionContext: string;
  targetTitle: string;
  targetContext: string;
  occurredAt: string;
}
