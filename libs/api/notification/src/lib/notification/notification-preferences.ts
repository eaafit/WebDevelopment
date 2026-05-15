import { create } from '@bufbuild/protobuf';
import {
  NotificationChannelTogglesSchema,
  NotificationSettingsSchema,
  type NotificationChannelToggles,
  type NotificationSettings,
} from '@notary-portal/api-contracts';

export type NotificationPreferenceCategory = 'assessment' | 'payment' | 'system';

export interface NotificationPreferenceRecord {
  userId: string;
  assessmentEmailEnabled: boolean;
  assessmentPushEnabled: boolean;
  assessmentInAppEnabled: boolean;
  paymentEmailEnabled: boolean;
  paymentPushEnabled: boolean;
  paymentInAppEnabled: boolean;
  systemEmailEnabled: boolean;
  systemPushEnabled: boolean;
  systemInAppEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferenceRecord, 'userId'> = {
  assessmentEmailEnabled: true,
  assessmentPushEnabled: true,
  assessmentInAppEnabled: true,
  paymentEmailEnabled: true,
  paymentPushEnabled: true,
  paymentInAppEnabled: true,
  systemEmailEnabled: true,
  systemPushEnabled: true,
  systemInAppEnabled: true,
};

export function toRpcNotificationSettings(
  record: NotificationPreferenceRecord,
): NotificationSettings {
  return create(NotificationSettingsSchema, {
    assessment: createChannelToggles(
      record.assessmentEmailEnabled,
      record.assessmentPushEnabled,
      record.assessmentInAppEnabled,
    ),
    payment: createChannelToggles(
      record.paymentEmailEnabled,
      record.paymentPushEnabled,
      record.paymentInAppEnabled,
    ),
    system: createChannelToggles(
      record.systemEmailEnabled,
      record.systemPushEnabled,
      record.systemInAppEnabled,
    ),
  });
}

export function fromRpcNotificationSettings(
  userId: string,
  settings: NotificationSettings,
): NotificationPreferenceRecord {
  return {
    userId,
    assessmentEmailEnabled: settings.assessment?.emailEnabled ?? true,
    assessmentPushEnabled: settings.assessment?.pushEnabled ?? true,
    assessmentInAppEnabled: settings.assessment?.inAppEnabled ?? true,
    paymentEmailEnabled: settings.payment?.emailEnabled ?? true,
    paymentPushEnabled: settings.payment?.pushEnabled ?? true,
    paymentInAppEnabled: settings.payment?.inAppEnabled ?? true,
    systemEmailEnabled: settings.system?.emailEnabled ?? true,
    systemPushEnabled: settings.system?.pushEnabled ?? true,
    systemInAppEnabled: settings.system?.inAppEnabled ?? true,
  };
}

export function isInAppEnabledForCategory(
  record: NotificationPreferenceRecord,
  category: NotificationPreferenceCategory,
): boolean {
  switch (category) {
    case 'payment':
      return record.paymentInAppEnabled;
    case 'system':
      return record.systemInAppEnabled;
    case 'assessment':
    default:
      return record.assessmentInAppEnabled;
  }
}

function createChannelToggles(
  emailEnabled: boolean,
  pushEnabled: boolean,
  inAppEnabled: boolean,
): NotificationChannelToggles {
  return create(NotificationChannelTogglesSchema, {
    emailEnabled,
    pushEnabled,
    inAppEnabled,
  });
}
