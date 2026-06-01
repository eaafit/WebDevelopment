import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { PrismaService } from '@internal/prisma';
import { Injectable } from '@nestjs/common';
import {
  NotificationCategory as RpcNotificationCategory,
  NotificationSchema,
  NotificationStatus as RpcNotificationStatus,
  NotificationType as RpcNotificationType,
  ListNotificationsResponseSchema,
  PaginationMetaSchema,
  type Notification as RpcNotification,
  type ListNotificationsResponse,
} from '@notary-portal/api-contracts';
import {
  NotificationCategory as PrismaNotificationCategory,
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
  title?: string;
  message: string;
  category?: RpcNotificationCategory;
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
        title: input.title ?? 'Уведомление',
        type: this.toPrismaType(input.type ?? RpcNotificationType.PUSH),
        category: this.toPrismaCategory(input.category ?? RpcNotificationCategory.SYSTEM),
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

  async markAsRead(id: string): Promise<{ notification: RpcNotification; updated: boolean }> {
    const existing = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ConnectError('notification was not found', Code.NotFound);
    }

    if (existing.readAt) {
      return { notification: this.toMessage(existing), updated: false };
    }

    const readAt = new Date();
    const notification = await this.prisma.notification.update({
      where: { id },
      data: { readAt },
    });

    return { notification: this.toMessage({ ...notification, readAt }), updated: true };
  }

  async markAllAsRead(userId: string): Promise<RpcNotification[]> {
    const unreadNotifications = await this.prisma.notification.findMany({
      where: { userId, readAt: null },
      orderBy: { sentAt: 'desc' },
    });

    if (!unreadNotifications.length) {
      return [];
    }

    const readAt = new Date();
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt },
    });

    return unreadNotifications.map((notification) =>
      this.toMessage({ ...notification, readAt }),
    );
  }

  async deleteNotification(id: string): Promise<boolean> {
    const result = await this.prisma.notification.deleteMany({ where: { id } });
    return result.count > 0;
  }

  // Private helpers

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
    title: string;
    type: PrismaNotificationType;
    category: PrismaNotificationCategory;
    message: string;
    sentAt: Date;
    status: PrismaNotificationStatus;
    readAt: Date | null;
  }): RpcNotification {
    return create(NotificationSchema, {
      id: n.id,
      userId: n.userId,
      title: n.title,
      message: n.message,
      type: this.fromPrismaType(n.type),
      category: this.fromPrismaCategory(n.category),
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
      [RpcNotificationType.IN_APP]: PrismaNotificationType.InApp,
    };
    return map[t] ?? PrismaNotificationType.Push;
  }

  private fromPrismaType(t: PrismaNotificationType): RpcNotificationType {
    const map: Record<PrismaNotificationType, RpcNotificationType> = {
      [PrismaNotificationType.Email]: RpcNotificationType.EMAIL,
      [PrismaNotificationType.SMS]:   RpcNotificationType.SMS,
      [PrismaNotificationType.Push]:  RpcNotificationType.PUSH,
      [PrismaNotificationType.InApp]: RpcNotificationType.IN_APP,
    };
    return map[t];
  }

  private toPrismaCategory(c: RpcNotificationCategory): PrismaNotificationCategory {
    const map: Record<number, PrismaNotificationCategory> = {
      [RpcNotificationCategory.APPLICATION]: PrismaNotificationCategory.Application,
      [RpcNotificationCategory.DOCUMENT]: PrismaNotificationCategory.Document,
      [RpcNotificationCategory.PAYMENT]: PrismaNotificationCategory.Payment,
      [RpcNotificationCategory.SYSTEM]: PrismaNotificationCategory.System,
      [RpcNotificationCategory.ASSESSMENT]: PrismaNotificationCategory.Assessment,
    };
    return map[c] ?? PrismaNotificationCategory.System;
  }

  private fromPrismaCategory(c: PrismaNotificationCategory): RpcNotificationCategory {
    const map: Record<PrismaNotificationCategory, RpcNotificationCategory> = {
      [PrismaNotificationCategory.Application]: RpcNotificationCategory.APPLICATION,
      [PrismaNotificationCategory.Document]: RpcNotificationCategory.DOCUMENT,
      [PrismaNotificationCategory.Payment]: RpcNotificationCategory.PAYMENT,
      [PrismaNotificationCategory.System]: RpcNotificationCategory.SYSTEM,
      [PrismaNotificationCategory.Assessment]: RpcNotificationCategory.ASSESSMENT,
    };
    return map[c] ?? RpcNotificationCategory.SYSTEM;
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
