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

  async listActiveUserIdsByRole(role: PrismaRole): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role,
        isActive: true,
      },
      select: {
        id: true,
      },
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
    const existing = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ConnectError('notification was not found', Code.NotFound);
    }

    if (existing.readAt) {
      return this.toMessage(existing);
    }

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
    return map[c];
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
