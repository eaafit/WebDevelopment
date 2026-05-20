import { create } from '@bufbuild/protobuf';
import {
  NotificationChannelTogglesSchema,
  NotificationSettingsSchema,
  type NotificationChannelToggles,
  type NotificationSettings,
} from '@notary-portal/api-contracts';
import {
  NotificationEntityCategory,
  NotificationPreferenceChannel,
  NotificationPreferenceStatus,
} from '@internal/prisma-client';

export type NotificationPreferenceCategory = 'assessment' | 'payment' | 'system';

export interface NotificationPreferenceRow {
  id: string;
  userId: string;
  channel: NotificationPreferenceChannel;
  entityCategory: NotificationEntityCategory;
  status: NotificationPreferenceStatus;
  updatedAt: Date;
}

const CHANNELS: NotificationPreferenceChannel[] = [
  NotificationPreferenceChannel.Email,
  NotificationPreferenceChannel.Sms,
  NotificationPreferenceChannel.Push,
  NotificationPreferenceChannel.InApp,
];

const CATEGORIES: NotificationEntityCategory[] = [
  NotificationEntityCategory.Assessment,
  NotificationEntityCategory.Payment,
  NotificationEntityCategory.System,
];

export function defaultPreferenceRows(userId: string): Array<{
  userId: string;
  channel: NotificationPreferenceChannel;
  entityCategory: NotificationEntityCategory;
  status: NotificationPreferenceStatus;
}> {
  return CHANNELS.flatMap((channel) =>
    CATEGORIES.map((entityCategory) => ({
      userId,
      channel,
      entityCategory,
      status: NotificationPreferenceStatus.Active,
    })),
  );
}

export function rowsToPreferenceMatrix(rows: NotificationPreferenceRow[]): NotificationSettings {
  const matrix = createEmptyMatrix();

  for (const row of rows) {
    const category = entityCategoryToCategory(row.entityCategory);
    const toggles = matrix[category];
    if (!toggles) {
      continue;
    }

    const enabled = row.status === NotificationPreferenceStatus.Active;
    if (row.channel === NotificationPreferenceChannel.Email) {
      toggles.emailEnabled = enabled;
    } else if (row.channel === NotificationPreferenceChannel.Push) {
      toggles.pushEnabled = enabled;
    } else if (row.channel === NotificationPreferenceChannel.InApp) {
      toggles.inAppEnabled = enabled;
    }
  }

  return create(NotificationSettingsSchema, {
    assessment: matrix.assessment,
    payment: matrix.payment,
    system: matrix.system,
  });
}

export function preferenceMatrixToRows(
  userId: string,
  settings: NotificationSettings,
): Array<{
  userId: string;
  channel: NotificationPreferenceChannel;
  entityCategory: NotificationEntityCategory;
  status: NotificationPreferenceStatus;
}> {
  const rows: Array<{
    userId: string;
    channel: NotificationPreferenceChannel;
    entityCategory: NotificationEntityCategory;
    status: NotificationPreferenceStatus;
  }> = [];

  const categories: NotificationPreferenceCategory[] = ['assessment', 'payment', 'system'];

  for (const category of categories) {
    const toggles = settings[category];
    if (!toggles) {
      continue;
    }

    const entityCategory = categoryToEntityCategory(category);

    rows.push({
      userId,
      channel: NotificationPreferenceChannel.Email,
      entityCategory,
      status: toggles.emailEnabled
        ? NotificationPreferenceStatus.Active
        : NotificationPreferenceStatus.Inactive,
    });
    rows.push({
      userId,
      channel: NotificationPreferenceChannel.Push,
      entityCategory,
      status: toggles.pushEnabled
        ? NotificationPreferenceStatus.Active
        : NotificationPreferenceStatus.Inactive,
    });
    rows.push({
      userId,
      channel: NotificationPreferenceChannel.InApp,
      entityCategory,
      status: toggles.inAppEnabled
        ? NotificationPreferenceStatus.Active
        : NotificationPreferenceStatus.Inactive,
    });
    rows.push({
      userId,
      channel: NotificationPreferenceChannel.Sms,
      entityCategory,
      status: NotificationPreferenceStatus.Active,
    });
  }

  return rows;
}

export function isInAppEnabledForCategory(
  rows: NotificationPreferenceRow[],
  category: NotificationPreferenceCategory,
): boolean {
  const entityCategory = categoryToEntityCategory(category);
  const row = rows.find(
    (entry) =>
      entry.entityCategory === entityCategory &&
      entry.channel === NotificationPreferenceChannel.InApp,
  );

  return row ? row.status === NotificationPreferenceStatus.Active : true;
}

function createEmptyMatrix(): Record<
  NotificationPreferenceCategory,
  NotificationChannelToggles
> {
  return {
    assessment: create(NotificationChannelTogglesSchema, {
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
    }),
    payment: create(NotificationChannelTogglesSchema, {
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
    }),
    system: create(NotificationChannelTogglesSchema, {
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
    }),
  };
}

function categoryToEntityCategory(
  category: NotificationPreferenceCategory,
): NotificationEntityCategory {
  switch (category) {
    case 'payment':
      return NotificationEntityCategory.Payment;
    case 'system':
      return NotificationEntityCategory.System;
    case 'assessment':
    default:
      return NotificationEntityCategory.Assessment;
  }
}

function entityCategoryToCategory(
  entityCategory: NotificationEntityCategory,
): NotificationPreferenceCategory {
  switch (entityCategory) {
    case NotificationEntityCategory.Payment:
      return 'payment';
    case NotificationEntityCategory.System:
      return 'system';
    case NotificationEntityCategory.Assessment:
    default:
      return 'assessment';
  }
}
