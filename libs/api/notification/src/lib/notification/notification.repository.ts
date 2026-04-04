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

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

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
