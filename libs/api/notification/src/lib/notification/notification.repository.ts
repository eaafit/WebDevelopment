import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { PrismaService } from '@internal/prisma';
import { Injectable } from '@nestjs/common';
import {
  NotificationSchema,
  NotificationStatus as RpcNotificationStatus,
  NotificationType as RpcNotificationType,
  ListNotificationsResponseSchema,
  PaginationMetaSchema,
  type Notification as RpcNotification,
  type ListNotificationsResponse,
} from '@notary-portal/api-contracts';
import {
  NotificationStatus as PrismaNotificationStatus,
  NotificationType as PrismaNotificationType,
  Role as PrismaRole,
  type Prisma,
} from '@internal/prisma-client';
import {
  NotificationEntityCategory,
  NotificationPreferenceChannel,
  NotificationPreferenceStatus,
} from '@internal/prisma-client';
import {
  defaultPreferenceRows,
  isInAppEnabledForCategory,
  preferenceMatrixToRows,
  rowsToPreferenceMatrix,
  type NotificationPreferenceCategory,
  type NotificationPreferenceRow,
} from './notification-preferences';
import type { NotificationSettings } from '@notary-portal/api-contracts';

export interface NotificationQuery {
  page: number;
  limit: number;
  userId: string;
  types?: RpcNotificationType[];
  statuses?: RpcNotificationStatus[];
  unreadOnly?: boolean;
}

export interface CreateNotificationInput {
  userId: string;
  message: string;
  type?: RpcNotificationType;
  status?: RpcNotificationStatus;
  sentAt?: Date;
  readAt?: Date | null;
}

export interface CreateManyNotificationsInput {
  userIds: string[];
  message: string;
  type?: PrismaNotificationType;
  status?: PrismaNotificationStatus;
}

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(input: CreateNotificationInput): Promise<RpcNotification> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: this.toPrismaType(input.type ?? RpcNotificationType.PUSH),
        message: input.message,
        status: this.toPrismaStatus(input.status ?? RpcNotificationStatus.SENT),
        sentAt: input.sentAt ?? new Date(),
        ...(input.readAt === undefined ? {} : { readAt: input.readAt }),
      },
    });

    return this.toMessage(notification);
  }

  async createManyNotifications(input: CreateManyNotificationsInput): Promise<void> {
    if (!input.userIds.length) {
      return;
    }

    await this.prisma.notification.createMany({
      data: input.userIds.map((userId) => ({
        userId,
        message: input.message,
        type: input.type ?? PrismaNotificationType.Push,
        status: input.status ?? PrismaNotificationStatus.Sent,
      })),
    });
  }

  async getOrCreatePreferenceRows(userId: string): Promise<NotificationPreferenceRow[]> {
    const existing = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    if (existing.length >= CHANNEL_CATEGORY_COMBINATIONS) {
      return existing.map(toPreferenceRow);
    }

    const existingKeys = new Set(
      existing.map((row) => preferenceKey(row.channel, row.entityCategory)),
    );

    const missing = defaultPreferenceRows(userId).filter(
      (row) => !existingKeys.has(preferenceKey(row.channel, row.entityCategory)),
    );

    if (missing.length) {
      await this.prisma.notificationPreference.createMany({
        data: missing,
        skipDuplicates: true,
      });
    }

    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    return rows.map(toPreferenceRow);
  }

  async getOrCreatePreferencesMatrix(userId: string): Promise<NotificationSettings> {
    const rows = await this.getOrCreatePreferenceRows(userId);
    return rowsToPreferenceMatrix(rows);
  }

  async updatePreferencesMatrix(
    userId: string,
    settings: NotificationSettings,
  ): Promise<NotificationSettings> {
    const desired = preferenceMatrixToRows(userId, settings);

    await this.prisma.$transaction(
      desired.map((row) =>
        this.prisma.notificationPreference.upsert({
          where: {
            userId_channel_entityCategory: {
              userId: row.userId,
              channel: row.channel,
              entityCategory: row.entityCategory,
            },
          },
          create: row,
          update: {
            status: row.status,
          },
        }),
      ),
    );

    const rows = await this.getOrCreatePreferenceRows(userId);
    return rowsToPreferenceMatrix(rows);
  }

  async filterUserIdsWithInAppEnabled(
    userIds: string[],
    category: NotificationPreferenceCategory,
  ): Promise<string[]> {
    if (!userIds.length) {
      return [];
    }

    const preferenceByUserId = new Map<string, NotificationPreferenceRow[]>();
    for (const userId of userIds) {
      preferenceByUserId.set(userId, []);
    }

    const allRows = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: userIds } },
    });

    for (const row of allRows) {
      const list = preferenceByUserId.get(row.userId) ?? [];
      list.push(toPreferenceRow(row));
      preferenceByUserId.set(row.userId, list);
    }

    return userIds.filter((userId) => {
      const rows = preferenceByUserId.get(userId) ?? [];
      return isInAppEnabledForCategory(rows, category);
    });
  }

  async listActiveUserIdsByRoles(roles: PrismaRole[]): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: roles },
        isActive: true,
      },
      select: { id: true },
    });

    return users.map((user) => user.id);
  }

  async listNotifications(query: NotificationQuery): Promise<ListNotificationsResponse> {
    const { page, limit } = query;
    const where = this.buildWhere(query);

    const [totalItems, unreadCount, notifications] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
      this.prisma.notification.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return create(ListNotificationsResponseSchema, {
      notifications: notifications.map((n) => this.toMessage(n)),
      meta: create(PaginationMetaSchema, {
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
        perPage: limit,
      }),
      unreadCount,
    });
  }

  async markAsRead(id: string): Promise<RpcNotification> {
    const notification = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.toMessage(notification);
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  async deleteNotification(id: string): Promise<boolean> {
    await this.prisma.notification.delete({ where: { id } });
    return true;
  }

  // ─── Private helpers ────────────────────────────────────────

  private buildWhere(query: NotificationQuery): Prisma.NotificationWhereInput {
    const where: Prisma.NotificationWhereInput = { userId: query.userId };

    if (query.types?.length) {
      where.type = { in: query.types.map((t) => this.toPrismaType(t)) };
    }
    if (query.statuses?.length) {
      where.status = { in: query.statuses.map((s) => this.toPrismaStatus(s)) };
    }
    if (query.unreadOnly) {
      where.readAt = null;
    }

    return where;
  }

  private toMessage(n: {
    id: string;
    userId: string;
    type: PrismaNotificationType;
    message: string;
    sentAt: Date;
    status: PrismaNotificationStatus;
    readAt: Date | null;
  }): RpcNotification {
    return create(NotificationSchema, {
      id: n.id,
      userId: n.userId,
      message: n.message,
      type: this.fromPrismaType(n.type),
      status: this.fromPrismaStatus(n.status),
      sentAt: timestampFromDate(n.sentAt),
      ...(n.readAt && { readAt: timestampFromDate(n.readAt) }),
    });
  }

  private toPrismaType(t: RpcNotificationType): PrismaNotificationType {
    const map: Record<number, PrismaNotificationType> = {
      [RpcNotificationType.EMAIL]: PrismaNotificationType.Email,
      [RpcNotificationType.SMS]:   PrismaNotificationType.SMS,
      [RpcNotificationType.PUSH]:  PrismaNotificationType.Push,
    };
    return map[t] ?? PrismaNotificationType.Push;
  }

  private fromPrismaType(t: PrismaNotificationType): RpcNotificationType {
    const map: Record<PrismaNotificationType, RpcNotificationType> = {
      [PrismaNotificationType.Email]: RpcNotificationType.EMAIL,
      [PrismaNotificationType.SMS]:   RpcNotificationType.SMS,
      [PrismaNotificationType.Push]:  RpcNotificationType.PUSH,
    };
    return map[t];
  }

  private toPrismaStatus(s: RpcNotificationStatus): PrismaNotificationStatus {
    const map: Record<number, PrismaNotificationStatus> = {
      [RpcNotificationStatus.PENDING]: PrismaNotificationStatus.Pending,
      [RpcNotificationStatus.SENT]:    PrismaNotificationStatus.Sent,
      [RpcNotificationStatus.FAILED]:  PrismaNotificationStatus.Failed,
    };
    return map[s] ?? PrismaNotificationStatus.Pending;
  }

  private fromPrismaStatus(s: PrismaNotificationStatus): RpcNotificationStatus {
    const map: Record<PrismaNotificationStatus, RpcNotificationStatus> = {
      [PrismaNotificationStatus.Pending]: RpcNotificationStatus.PENDING,
      [PrismaNotificationStatus.Sent]:    RpcNotificationStatus.SENT,
      [PrismaNotificationStatus.Failed]:  RpcNotificationStatus.FAILED,
    };
    return map[s];
  }
}

const CHANNEL_CATEGORY_COMBINATIONS = 12;

function toPreferenceRow(row: {
  id: string;
  userId: string;
  channel: NotificationPreferenceChannel;
  entityCategory: NotificationEntityCategory;
  status: NotificationPreferenceStatus;
  updatedAt: Date;
}): NotificationPreferenceRow {
  return {
    id: row.id,
    userId: row.userId,
    channel: row.channel,
    entityCategory: row.entityCategory,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

function preferenceKey(
  channel: NotificationPreferenceChannel,
  entityCategory: NotificationEntityCategory,
): string {
  return `${channel}:${entityCategory}`;
}

function categoryToEntityCategoryPrisma(
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
