import { PrismaService } from '@internal/prisma';
import {
  PaymentStatus as PrismaPaymentStatus,
  PaymentType as PrismaPaymentType,
  Role as PrismaRole,
} from '@internal/prisma-client';
import { NotificationService } from '@internal/notification';
import {
  NotificationCategory as RpcNotificationCategory,
  NotificationType as RpcNotificationType,
} from '@notary-portal/api-contracts';
import { Injectable, Logger } from '@nestjs/common';
import { shortId } from './payment-audit';

export interface PaymentNotificationSnapshot {
  id: string;
  userId?: string | null;
  type?: PrismaPaymentType | string | null;
  amount?: unknown;
  status?: PrismaPaymentStatus | string | null;
  paymentMethod?: string | null;
  transactionId?: string | null;
  subscriptionId?: string | null;
  assessmentId?: string | null;
}

@Injectable()
export class PaymentNotificationService {
  private readonly logger = new Logger(PaymentNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async notifyPaymentCreated(payment: PaymentNotificationSnapshot): Promise<void> {
    const summary = buildPaymentSummary(payment);

    await this.notifyUserAndAdmins({
      userId: payment.userId,
      userTitle: 'Платёж создан',
      userMessage: `Платёж ${shortId(payment.id)} создан: ${summary}. Ожидает подтверждения оплаты.`,
      adminTitle: 'Платёж создан',
      adminMessage: `Платёж создан: ${summary}, пользователь ${formatUser(payment.userId)}.`,
    });
  }

  async notifyPaymentCreationFailed(
    payment: PaymentNotificationSnapshot,
    errorMessage: string,
  ): Promise<void> {
    const summary = buildPaymentSummary(payment);

    await this.notifyUserAndAdmins({
      userId: payment.userId,
      userTitle: 'Платёж не создан',
      userMessage: `Платёж ${shortId(payment.id)} не создан: ${errorMessage}.`,
      adminTitle: 'Платёж не создан',
      adminMessage: `Платёж не создан: ${summary}, пользователь ${formatUser(
        payment.userId,
      )}. Ошибка: ${errorMessage}.`,
    });
  }

  async notifyPaymentCompleted(payment: PaymentNotificationSnapshot): Promise<void> {
    const summary = buildPaymentSummary(payment);

    await this.notifyUserAndAdmins({
      userId: payment.userId,
      userTitle: 'Платёж оплачен',
      userMessage: `Платёж ${shortId(payment.id)} успешно оплачен: ${summary}.`,
      adminTitle: 'Платёж оплачен',
      adminMessage: `Платёж оплачен: ${summary}, пользователь ${formatUser(payment.userId)}.`,
    });
  }

  async notifyPaymentFailed(payment: PaymentNotificationSnapshot): Promise<void> {
    const summary = buildPaymentSummary(payment);

    await this.notifyUserAndAdmins({
      userId: payment.userId,
      userTitle: 'Платёж отклонён',
      userMessage: `Платёж ${shortId(payment.id)} отклонён: ${summary}.`,
      adminTitle: 'Платёж отклонён',
      adminMessage: `Платёж отклонён: ${summary}, пользователь ${formatUser(payment.userId)}.`,
    });
  }

  async notifyPaymentUpdated(payment: PaymentNotificationSnapshot): Promise<void> {
    const summary = buildPaymentSummary(payment);

    await this.notifyUserAndAdmins({
      userId: payment.userId,
      userTitle: 'Платёж обновлён',
      userMessage: `Платёж ${shortId(payment.id)} обновлён: ${summary}.`,
      adminTitle: 'Платёж обновлён',
      adminMessage: `Платёж обновлён: ${summary}, пользователь ${formatUser(payment.userId)}.`,
    });
  }

  async notifyPaymentDeleted(payment: PaymentNotificationSnapshot): Promise<void> {
    const summary = buildPaymentSummary(payment);

    await this.notifyUserAndAdmins({
      userId: payment.userId,
      userTitle: 'Платёж удалён',
      userMessage: `Платёж ${shortId(payment.id)} удалён.`,
      adminTitle: 'Платёж удалён',
      adminMessage: `Платёж удалён: ${summary}, пользователь ${formatUser(payment.userId)}.`,
    });
  }

  private async notifyUserAndAdmins(params: {
    userId?: string | null;
    userTitle: string;
    userMessage: string;
    adminTitle: string;
    adminMessage: string;
  }): Promise<void> {
    await Promise.all([
      params.userId
        ? this.notifyUserBestEffort(params.userId, params.userTitle, params.userMessage)
        : undefined,
      this.notifyAdminsBestEffort(params.adminTitle, params.adminMessage, {
        excludeUserIds: params.userId ? [params.userId] : [],
      }),
    ]);
  }

  private async notifyUserBestEffort(
    userId: string,
    title: string,
    message: string,
  ): Promise<void> {
    try {
      await this.createPaymentNotification({ userId, title, message });
    } catch (error) {
      this.logger.warn(
        `Failed to create payment notification for user ${userId}: ${getErrorMessage(error)}`,
      );
    }
  }

  private async notifyAdminsBestEffort(
    title: string,
    message: string,
    options: { excludeUserIds?: string[] } = {},
  ): Promise<void> {
    try {
      const excluded = new Set(options.excludeUserIds ?? []);
      const admins = await this.prisma.user.findMany({
        where: {
          role: PrismaRole.Admin,
          isActive: true,
          ...(excluded.size ? { id: { notIn: [...excluded] } } : {}),
        },
        select: { id: true },
      });

      const results = await Promise.allSettled(
        admins.map((admin) =>
          this.createPaymentNotification({
            userId: admin.id,
            title,
            message,
          }),
        ),
      );
      const failedCount = results.filter((result) => result.status === 'rejected').length;

      if (failedCount) {
        this.logger.warn(`Failed to create ${failedCount} admin payment notification(s)`);
      }
    } catch (error) {
      this.logger.warn(`Failed to create admin payment notifications: ${getErrorMessage(error)}`);
    }
  }

  private createPaymentNotification(params: {
    userId: string;
    title: string;
    message: string;
  }): Promise<void> {
    return this.notificationService.createInternalNotification({
      userId: params.userId,
      title: params.title,
      message: params.message,
      category: RpcNotificationCategory.PAYMENT,
      type: RpcNotificationType.IN_APP,
    });
  }
}

function buildPaymentSummary(payment: PaymentNotificationSnapshot): string {
  return [
    `${getPaymentTypeLabel(payment.type)} ${shortId(payment.id)}`,
    formatAmount(payment.amount),
    payment.status ? `статус ${getPaymentStatusLabel(payment.status)}` : null,
    payment.paymentMethod ? `метод ${payment.paymentMethod}` : null,
    payment.transactionId ? `транзакция ${payment.transactionId}` : null,
    payment.subscriptionId ? `подписка ${shortId(payment.subscriptionId)}` : null,
    payment.assessmentId ? `заявка ${shortId(payment.assessmentId)}` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function getPaymentTypeLabel(type: PrismaPaymentType | string | null | undefined): string {
  switch (type) {
    case PrismaPaymentType.Subscription:
    case 'Subscription':
      return 'оплата подписки';
    case PrismaPaymentType.Assessment:
    case 'Assessment':
      return 'оплата услуги оценки';
    case PrismaPaymentType.DocumentCopy:
    case 'DocumentCopy':
      return 'оплата копии документа';
    default:
      return 'платёж';
  }
}

function getPaymentStatusLabel(status: PrismaPaymentStatus | string): string {
  switch (status) {
    case PrismaPaymentStatus.Pending:
    case 'Pending':
      return 'ожидает оплаты';
    case PrismaPaymentStatus.Completed:
    case 'Completed':
      return 'оплачен';
    case PrismaPaymentStatus.Failed:
    case 'Failed':
      return 'ошибка оплаты';
    case PrismaPaymentStatus.Refunded:
    case 'Refunded':
      return 'возврат';
    default:
      return String(status);
  }
}

function formatAmount(amount: unknown): string | null {
  if (amount === undefined || amount === null || amount === '') {
    return null;
  }

  return `сумма ${String(amount)} RUB`;
}

function formatUser(userId: string | null | undefined): string {
  return userId ? shortId(userId) : 'не указан';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}
