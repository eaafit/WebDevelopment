import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { getCurrentUser } from '@internal/auth-shared';
import { BitrixOrderPublisherService } from '@notary-portal/bitrix-orders';
import { AuditService } from '@internal/audit';
import { NotificationService } from '@internal/notification';
import {
  NotificationCategory as RpcNotificationCategory,
  NotificationType as RpcNotificationType,
} from '@notary-portal/api-contracts';
import { Role as PrismaRole, type Lead } from '@internal/prisma-client';
import {
  BusinessOperations,
  NotarySpanAttributes,
  normalizeSpanActorRole,
  runInSpan,
  setSpanAttributes,
} from '@internal/tracing';
import { randomUUID } from 'crypto';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private bitrixOrderPublisher: BitrixOrderPublisherService,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

  // Получение списка заказов с фильтрацией и пагинацией
  async findMany(params: {
    userId?: string;
    role?: 'applicant' | 'notary';
    status?: string;
    searchQuery?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page: number;
    pageSize: number;
  }) {
    return runInSpan(
      'OrderService.findMany',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.orderList,
        [NotarySpanAttributes.entity]: 'Order',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(getCurrentUser()?.role),
        'order.filter.has_status': Boolean(params.status && params.status !== 'all'),
        'order.filter.has_search': Boolean(params.searchQuery?.trim()),
        'order.filter.has_date_range': Boolean(params.dateFrom || params.dateTo),
        'order.page_size': params.pageSize,
      },
      async (span) => {
        const { userId, role, status, searchQuery, dateFrom, dateTo, page, pageSize } = params;
        const where: any = {};

        if (role === 'applicant') {
          where.applicantId = userId;
        }
        // } else if (role === 'notary') {
        //   where.executorId = userId;
        // }

        if (status && status !== 'all') {
          let dbStatus: string;
          switch (status) {
            case 'created':
              dbStatus = 'New';
              break;
            case 'accepted':
              dbStatus = 'Verified';
              break;
            case 'under_review':
              dbStatus = 'InProgress';
              break;
            case 'completed':
              dbStatus = 'Completed';
              break;
            case 'rejected':
              dbStatus = 'Cancelled';
              break;
            default:
              dbStatus = status;
          }
          where.assessment = { status: dbStatus };
        }
        if (dateFrom || dateTo) {
          where.startDate = {};
          if (dateFrom) where.startDate.gte = dateFrom;
          if (dateTo) where.startDate.lte = dateTo;
        }
        if (searchQuery) {
          where.OR = [
            { id: { contains: searchQuery, mode: 'insensitive' } },
            { assessment: { address: { contains: searchQuery, mode: 'insensitive' } } },
          ];
        }

        try {
          const total = await this.prisma.lead.count({ where });

          const leads = await this.prisma.lead.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
              applicant: { select: { id: true, fullName: true } },
              executor: { select: { id: true, fullName: true } },
              assessment: {
                include: {
                  realEstateObject: true,
                },
              },
            },
            orderBy: { startDate: 'desc' },
          });

          const orders = leads.map((lead) => this.mapLeadToOrder(lead));
          const totalPages = Math.ceil(total / pageSize);
          setSpanAttributes(span, {
            'order.result_count': orders.length,
            'order.total_count': total,
            'order.total_pages': totalPages,
          });
          return { orders, total, totalPages };
        } catch (error) {
          this.logError('findMany', error);
          throw error;
        }
      },
    );
  }

  // Получение одного заказа по ID
  async findOne(id: string) {
    return runInSpan(
      'OrderService.findOne',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.orderGet,
        [NotarySpanAttributes.entity]: 'Order',
      },
      async () => {
        const lead = await this.prisma.lead.findUnique({
          where: { id },
          include: {
            applicant: { select: { id: true, fullName: true } },
            executor: { select: { id: true, fullName: true } },
            assessment: {
              include: {
                realEstateObject: true,
              },
            },
          },
        });
        if (!lead) throw new Error('Order not found');
        return this.mapLeadToOrder(lead);
      },
    );
  }

  async takeOrder(orderId: string, notaryId: string): Promise<any> {
    return runInSpan(
      'OrderService.takeOrder',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.orderTake,
        [NotarySpanAttributes.entity]: 'Order',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(getCurrentUser()?.role),
      },
      async (span) => {
        const updatedLead = await this.prisma.$transaction(async (tx) => {
          // 1. Найти lead вместе с assessment
          const lead = await tx.lead.findUnique({
            where: { id: orderId },
            include: { assessment: true },
          });
          if (!lead) throw new Error('Order not found');
          setSpanAttributes(span, {
            'order.has_executor': Boolean(lead.executorId),
            'assessment.status.from': lead.assessment.status,
          });
          if (lead.executorId) throw new Error('Order already taken by another notary');

          // 2. Обновить lead
          const updatedLead = await tx.lead.update({
            where: { id: orderId },
            data: {
              executorId: notaryId,
              plannedCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 дней
            },
            include: {
              applicant: { select: { id: true, fullName: true } },
              executor: { select: { id: true, fullName: true } },
              assessment: {
                include: { realEstateObject: true },
              },
            },
          });

          // 3. Если статус заявки 'New' → меняем на 'Verified'
          if (updatedLead.assessment.status === 'New') {
            await tx.assessment.update({
              where: { id: updatedLead.assessmentId },
              data: { status: 'Verified' },
            });
            updatedLead.assessment.status = 'Verified';
          }

          setSpanAttributes(span, {
            'assessment.status.to': updatedLead.assessment.status,
          });
          return updatedLead;
        });

        await this.recordOrderTaken(updatedLead, notaryId);
        return this.mapLeadToOrder(updatedLead);
      },
    );
  }

  private mapAssessmentStatusToOrderStatus(assessmentStatus: any): string {
    const statusStr = assessmentStatus?.toString() ?? '';

    const mapping: Record<string, string> = {
      new: 'created',
      verified: 'accepted',
      in_progress: 'under_review',
      completed: 'completed',
      cancelled: 'rejected',
      New: 'created',
      Verified: 'accepted',
      InProgress: 'under_review',
      Completed: 'completed',
      Cancelled: 'rejected',
      '1': 'created',
      '2': 'accepted',
      '3': 'under_review',
      '4': 'completed',
      '5': 'rejected',
    };
    return mapping[statusStr] || 'created';
  }

  // Маппинг данных из БД в формат, который будет отправлен на фронт
  private mapLeadToOrder(lead: any) {
    try {
      const statusHistory = [] as any[];
      const realEstateObject = lead.assessment?.realEstateObject;

      const rawStatus = lead.assessment?.status;
      const mappedStatus = this.mapAssessmentStatusToOrderStatus(rawStatus);

      statusHistory.push({
        status: 'created',
        date: lead.startDate,
        comment: '',
      });

      if (lead.executorId) {
        const acceptedDate =
          lead.updatedAt && lead.updatedAt > lead.startDate ? lead.updatedAt : lead.startDate;
        statusHistory.push({
          status: 'accepted',
          date: acceptedDate,
          comment: 'Заказ взят в работу',
        });
      }

      if (lead.actualCompletionDate) {
        statusHistory.push({
          status: 'completed',
          date: lead.actualCompletionDate,
          comment: 'Заказ завершён',
        });
      }

      if (lead.assessment?.status === 'Cancelled') {
        statusHistory.push({
          status: 'rejected',
          date: lead.updatedAt || lead.startDate,
          comment: 'Заказ отклонён',
        });
      }

      const realEstateObjectMapped = realEstateObject
        ? {
            id: realEstateObject.id,
            address: realEstateObject.address,
            city: realEstateObject.city,
            area: realEstateObject.area,
            objectType: realEstateObject.objectType,
            roomsCount: realEstateObject.roomsCount,
            floor: realEstateObject.floor,
          }
        : {
            id: '',
            address: lead.assessment?.address || '',
            city: '',
            area: null,
            objectType: null,
            roomsCount: null,
            floor: null,
          };

      const order = {
        id: lead.id,
        assessmentId: lead.assessmentId,
        objectAddress: lead.assessment?.address || '',
        orderDate: lead.startDate,
        status: mappedStatus,
        totalAmount: lead.assessment?.estimatedValue,
        statusHistory,
        applicantId: lead.applicant?.id,
        applicantName: lead.applicant?.fullName,
        notaryId: lead.executor?.id,
        notaryName: lead.executor?.fullName,
        plannedCompletionDate: lead.plannedCompletionDate,
        actualCompletionDate: lead.actualCompletionDate,
        transactionId: lead.transactionId,
        realEstateObject: realEstateObjectMapped,
      };
      return order;
    } catch (error) {
      this.logError('mapLeadToOrder', error);
      throw error;
    }
  }

  async createOrder(assessmentId: string, applicantId: string): Promise<Lead> {
    return runInSpan(
      'OrderService.createOrder',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.orderCreate,
        [NotarySpanAttributes.entity]: 'Order',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(getCurrentUser()?.role),
      },
      async () => {
        this.logger.log('Creating order; operation=order.create; result=start');
        const startDate = new Date();
        const plannedCompletionDate = new Date(startDate);
        plannedCompletionDate.setDate(startDate.getDate() + 7);

        try {
          const lead = await this.prisma.lead.create({
            data: {
              id: randomUUID(),
              applicantId,
              assessmentId,
              startDate,
              plannedCompletionDate,
              createdAt: startDate,
              updatedAt: startDate,
            },
          });

          await this.recordOrderCreated(lead);
          this.logger.log('Created order; operation=order.create; result=success');
          return lead;
        } catch (error) {
          this.logError('createOrder', error);
          throw error;
        }
      },
    );
  }

  async completeOrder(orderId: string, finalEstimatedValue?: string): Promise<void> {
    return runInSpan(
      'OrderService.completeOrder',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.orderComplete,
        [NotarySpanAttributes.entity]: 'Order',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(getCurrentUser()?.role),
        'order.has_final_estimated_value': Boolean(finalEstimatedValue?.trim()),
      },
      async () => {
        try {
          const lead = await this.prisma.lead.findUnique({
            where: { id: orderId },
            include: { assessment: true },
          });
          if (!lead) throw new Error('Order not found');

          await this.prisma.lead.update({
            where: { id: orderId },
            data: { actualCompletionDate: new Date() },
          });

          await this.recordOrderCompleted(lead, finalEstimatedValue);
          this.logger.log('Completed order; operation=order.complete; result=success');
        } catch (error) {
          this.logError('completeOrder', error);
          throw error;
        }
      },
    );
  }

  async completeOrderForAssessment(
    assessmentId: string,
    finalEstimatedValue?: string,
  ): Promise<void> {
    return runInSpan(
      'OrderService.completeOrderForAssessment',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.orderComplete,
        [NotarySpanAttributes.entity]: 'Order',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(getCurrentUser()?.role),
        'order.complete.source': 'assessment',
      },
      async (span) => {
        const lead = await this.prisma.lead.findUnique({
          where: { assessmentId },
          select: { id: true },
        });
        setSpanAttributes(span, { 'order.found': Boolean(lead) });
        if (!lead) {
          return;
        }

        await this.completeOrder(lead.id, finalEstimatedValue);
      },
    );
  }

  async publishOrderToBitrix(orderId: string): Promise<void> {
    return runInSpan(
      'BitrixOrderPublisherService.publishOrder side effect',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixOrderPublish,
        [NotarySpanAttributes.entity]: 'BitrixOrder',
      },
      async () => {
        await this.bitrixOrderPublisher.publishOrder(orderId);
      },
    );
  }

  private async recordOrderCreated(lead: Lead): Promise<void> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: lead.assessmentId },
      select: { address: true },
    });
    const displayId = shortOrderId(lead.id);
    const address = assessment?.address?.trim() || 'адрес не указан';

    await this.auditService.record({
      actorUserId: lead.applicantId,
      eventType: 'order.created',
      targetType: 'Order',
      targetId: lead.id,
      actionTitle: 'Создан заказ',
      actionContext: `Заказ ${displayId} создан на основе заявки`,
      targetTitle: `Заказ ${displayId}`,
      targetContext: address,
      after: {
        orderId: lead.id,
        assessmentId: lead.assessmentId,
        startDate: lead.startDate.toISOString(),
        plannedCompletionDate: lead.plannedCompletionDate.toISOString(),
      },
    });

    await this.notificationService.createInternalNotificationsForRole(PrismaRole.Admin, {
      title: 'Создан новый заказ',
      message: `Заказ ${displayId} создан на объект: ${address}.`,
      category: RpcNotificationCategory.ASSESSMENT,
      type: RpcNotificationType.IN_APP,
    });
  }

  private async recordOrderTaken(lead: Lead, notaryId: string): Promise<void> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: lead.assessmentId },
      select: { address: true },
    });
    const displayId = shortOrderId(lead.id);
    const address = assessment?.address?.trim() || 'адрес не указан';

    await this.auditService.record({
      actorUserId: notaryId,
      eventType: 'order.taken',
      targetType: 'Order',
      targetId: lead.id,
      actionTitle: 'Заказ взят в работу',
      actionContext: `Нотариус взял заказ ${displayId}`,
      targetTitle: `Заказ ${displayId}`,
      targetContext: address,
      after: {
        orderId: lead.id,
        notaryId,
        takenAt: new Date().toISOString(),
      },
    });

    await this.notificationService.createInternalNotificationsForRole(PrismaRole.Admin, {
      title: 'Заказ взят в работу',
      message: `Заказ ${displayId} (${address}) взят в работу нотариусом.`,
      category: RpcNotificationCategory.ASSESSMENT,
      type: RpcNotificationType.IN_APP,
    });
  }

  private async recordOrderCompleted(
    lead: Lead & { assessment?: { address?: string | null } | null },
    finalEstimatedValue?: string,
  ): Promise<void> {
    const displayId = shortOrderId(lead.id);
    const address = lead.assessment?.address?.trim() || 'адрес не указан';

    await this.auditService.record({
      actorUserId: getCurrentUser()?.sub,
      eventType: 'order.completed',
      targetType: 'Order',
      targetId: lead.id,
      actionTitle: 'Заказ завершён',
      actionContext: `Заказ ${displayId} завершён`,
      targetTitle: `Заказ ${displayId}`,
      targetContext: address,
      after: {
        orderId: lead.id,
        completionDate: new Date().toISOString(),
        finalEstimatedValue,
      },
    });

    await this.notificationService.createInternalNotificationsForRole(PrismaRole.Admin, {
      title: 'Заказ завершён',
      message: `Заказ ${displayId} (${address}) завершён.`,
      category: RpcNotificationCategory.ASSESSMENT,
      type: RpcNotificationType.IN_APP,
    });
  }

  async getRecentOrderEvents(userId: string, role: string, limit: number): Promise<any[]> {
    return runInSpan(
      'OrderService.getRecentOrderEvents',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.orderRecentEvents,
        [NotarySpanAttributes.entity]: 'Order',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(role),
        'order.events.limit': limit,
      },
      async (span) => {
        const where: any = {
          actionType: { in: ['order.created', 'order.taken', 'order.completed'] },
        };
        let orderIds: string[] = [];

        if (role === 'applicant') {
          const leads = await this.prisma.lead.findMany({
            where: { applicantId: userId },
            select: { id: true },
          });
          orderIds = leads.map((lead) => lead.id);
        } else if (role === 'notary') {
          const leads = await this.prisma.lead.findMany({
            where: {
              OR: [{ executorId: userId }, { executorId: null }],
            },
            select: { id: true },
          });
          orderIds = leads.map((lead) => lead.id);
        } else {
          setSpanAttributes(span, { 'order.events.result_count': 0 });
          return [];
        }

        if (orderIds.length === 0) {
          setSpanAttributes(span, { 'order.events.result_count': 0 });
          return [];
        }
        where.entityId = { in: orderIds };

        const logs = await this.prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: limit,
          include: { user: true },
        });

        const events: any[] = [];
        for (const log of logs) {
          if (!log.entityId) continue;
          const lead = await this.prisma.lead.findUnique({
            where: { id: log.entityId },
            include: { assessment: { select: { address: true } } },
          });
          if (!lead) continue;
          events.push({
            eventId: log.id,
            orderId: lead.id,
            orderAddress: lead.assessment?.address?.trim() || 'адрес не указан',
            eventType: log.actionType,
            eventDate: log.timestamp,
            actorName: log.user?.fullName || log.actorName || 'Система',
          });
        }

        setSpanAttributes(span, { 'order.events.result_count': events.length });
        return events;
      },
    );
  }

  private logError(operation: string, error: unknown): void {
    this.logger.error({
      operation,
      result: 'error',
      error: safeErrorName(error),
    });
  }
}

function safeErrorName(error: unknown): string {
  return error instanceof Error && error.name.trim() ? error.name : 'UnknownError';
}

function shortOrderId(id: string): string {
  return id.length > 8 ? `#${id.slice(0, 8)}` : `#${id}`;
}
