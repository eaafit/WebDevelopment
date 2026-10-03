import type { Notification as RpcNotification } from '@notary-portal/api-contracts';
import { notificationOccurredAt } from '../rpc/in-app-notifications-api.service';
import type {
  NotificationChannelFilter,
  NotificationTypeFilter,
  UiInAppNotification,
} from './notification.models';

export function mapRpcNotificationToUi(notification: RpcNotification): UiInAppNotification {
  const lines = notification.message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const title = humanizeTitle(lines[0] ?? 'Уведомление');
  const description = humanizeDescription(lines);
  const type = inferNotificationType(lines.join(' '));

  return {
    id: notification.id,
    title,
    description,
    createdAt: notificationOccurredAt(notification),
    isUnread: !notification.readAt,
    type,
    channel: 'in-app',
  };
}

export function relativeTimeFrom(date: Date): string {
  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (diffMinutes < 1) return 'только что';
  if (diffMinutes < 60) return `${diffMinutes} мин назад`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} дн назад`;
}

export function notificationTypeLabel(type: NotificationTypeFilter | UiInAppNotification['type']): string {
  switch (type) {
    case 'application':
      return 'Заявка';
    case 'document':
      return 'Документы';
    case 'payment':
      return 'Платёж';
    case 'system':
      return 'Система';
    default:
      return 'Все';
  }
}

export function notificationChannelLabel(
  channel: NotificationChannelFilter | UiInAppNotification['channel'],
): string {
  switch (channel) {
    case 'in-app':
      return 'In-app';
    case 'email':
      return 'Email';
    case 'push':
      return 'Push';
    default:
      return 'Все';
  }
}

export function notificationStatusLabel(isUnread: boolean): string {
  return isUnread ? 'Новое' : 'Прочитано';
}

function humanizeTitle(raw: string): string {
  return raw
    .replace(/^Была создана новая заявка на оценку$/i, 'Новая заявка на оценку')
    .trim();
}

function humanizeDescription(lines: string[]): string {
  const addressLine = lines.find((line) => line.startsWith('Адрес:'));
  if (addressLine) {
    return addressLine.replace(/^Адрес:\s*/i, '').trim();
  }

  const statusLine = lines.find((line) => line.startsWith('Статус:'));
  if (statusLine) {
    return statusLine.replace(/^Статус:\s*/i, '').trim();
  }

  const secondary = lines.slice(1).find((line) => !isTechnicalLine(line));
  return secondary ?? '';
}

function isTechnicalLine(line: string): boolean {
  return /^Заявка:\s*#/i.test(line) || /^Платёж:\s*#/i.test(line) || /^Платеж:\s*#/i.test(line);
}

function inferNotificationType(text: string): UiInAppNotification['type'] {
  const lower = text.toLowerCase();
  if (lower.includes('платёж') || lower.includes('платеж')) {
    return 'payment';
  }
  if (lower.includes('документ')) {
    return 'document';
  }
  if (lower.includes('заявк') || lower.includes('оценк')) {
    return 'application';
  }
  return 'system';
}
