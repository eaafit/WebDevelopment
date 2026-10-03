import { create } from '@bufbuild/protobuf';
import {
  NotificationChannelTogglesSchema,
  NotificationSettingsSchema,
  type NotificationChannelToggles,
  type NotificationSettings,
} from '@notary-portal/api-contracts';
import type { UiInAppNotification } from './notification.models';

export function normalizeNotificationSettings(
  settings: NotificationSettings | null | undefined,
): NotificationSettings {
  return create(NotificationSettingsSchema, {
    assessment: normalizeChannelToggles(settings?.assessment),
    payment: normalizeChannelToggles(settings?.payment),
    system: normalizeChannelToggles(settings?.system),
  });
}

export function normalizeChannelToggles(
  toggles: NotificationChannelToggles | undefined,
): NotificationChannelToggles {
  return create(NotificationChannelTogglesSchema, {
    emailEnabled: toggles?.emailEnabled ?? true,
    pushEnabled: toggles?.pushEnabled ?? true,
    inAppEnabled: toggles?.inAppEnabled ?? true,
  });
}

export function updateChannelToggle(
  settings: NotificationSettings,
  category: 'assessment' | 'payment' | 'system',
  channel: keyof NotificationChannelToggles,
  enabled: boolean,
): NotificationSettings {
  const normalized = normalizeNotificationSettings(settings);
  const current = normalized[category] ?? normalizeChannelToggles(undefined);

  return create(NotificationSettingsSchema, {
    assessment:
      category === 'assessment'
        ? create(NotificationChannelTogglesSchema, {
            emailEnabled: channel === 'emailEnabled' ? enabled : current.emailEnabled,
            pushEnabled: channel === 'pushEnabled' ? enabled : current.pushEnabled,
            inAppEnabled: channel === 'inAppEnabled' ? enabled : current.inAppEnabled,
          })
        : normalized.assessment,
    payment:
      category === 'payment'
        ? create(NotificationChannelTogglesSchema, {
            emailEnabled: channel === 'emailEnabled' ? enabled : current.emailEnabled,
            pushEnabled: channel === 'pushEnabled' ? enabled : current.pushEnabled,
            inAppEnabled: channel === 'inAppEnabled' ? enabled : current.inAppEnabled,
          })
        : normalized.payment,
    system:
      category === 'system'
        ? create(NotificationChannelTogglesSchema, {
            emailEnabled: channel === 'emailEnabled' ? enabled : current.emailEnabled,
            pushEnabled: channel === 'pushEnabled' ? enabled : current.pushEnabled,
            inAppEnabled: channel === 'inAppEnabled' ? enabled : current.inAppEnabled,
          })
        : normalized.system,
  });
}

export function isInAppNotificationEnabled(
  settings: NotificationSettings | null,
  item: UiInAppNotification,
): boolean {
  if (!settings) {
    return true;
  }

  switch (item.type) {
    case 'payment':
      return settings.payment?.inAppEnabled ?? true;
    case 'system':
      return settings.system?.inAppEnabled ?? true;
    case 'application':
    case 'document':
    default:
      return settings.assessment?.inAppEnabled ?? true;
  }
}
