import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { BitrixOrderPublisherService } from '@notary-portal/bitrix-orders';
import { AuditService } from '@internal/audit';
import { NotificationService } from '@internal/notification';
import { Role as PrismaRole } from '@internal/prisma-client';
import type { Lead } from '@internal/prisma-client';
import { NotificationCategory as RpcNotificationCategory, NotificationType as RpcNotificationType } from '@notary-portal/api-contracts';
import { getCurrentUser } from '@internal/auth-shared';
import { randomUUID } from 'crypto';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private bitrixOrderPublisher: BitrixOrderPublisherService,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) { }

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
    console.log('[OrderService] findMany params:', JSON.stringify(params, null, 2));
    // проверка что сервер работает с обновленным файлом
    // console.log('🔥🔥🔥 USING UPDATED ORDER.SERVICE.TS WITH SWITCH 🔥🔥🔥');
    const { userId, role, status, searchQuery, dateFrom, dateTo, page, pageSize } = params;
    const where: any = {};

    if (role === 'applicant') {
      where.applicantId = userId;
    }
    // } else if (role === 'notary') {
    //   where.executorId = userId;
    // }

    console.log('[OrderService] status filter raw value:', status, 'type:', typeof status);

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
      console.log('[OrderService] Filter status:', status, '-> DB status:', dbStatus);
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

    console.log('[OrderService] where clause:', JSON.stringify(where, null, 2));

    try {
      const total = await this.prisma.lead.count({ where });
      console.log('[OrderService] total count:', total);

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
      console.log('[OrderService] leads found:', leads.length);
      console.log('[OrderService] First lead assessment status:', leads[0]?.assessment?.status, typeof leads[0]?.assessment?.status);

      const orders = leads.map((lead) => this.mapLeadToOrder(lead));
      console.log('[OrderService] orders mapped:', orders.length);
      return { orders, total, totalPages: Math.ceil(total / pageSize) };
    } catch (error) {
      console.error('[OrderService] Error in findMany:', error);
      throw error;
    }
  }

  // Получение одного заказа по ID
  async findOne(id: string) {
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
  }

  async takeOrder(orderId: string, notaryId: string): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Найти lead вместе с assessment
      const lead = await tx.lead.findUnique({
        where: { id: orderId },
        include: { assessment: true },
      });
      if (!lead) throw new Error('Order not found');
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

      await this.recordOrderTaken(updatedLead, notaryId);

      return this.mapLeadToOrder(updatedLead);
    });
  }

  private mapAssessmentStatusToOrderStatus(assessmentStatus: any): string {
    const statusStr = assessmentStatus?.toString() ?? '';
    console.log('[OrderService] mapAssessmentStatusToOrderStatus input:', statusStr, typeof statusStr);

    const mapping: Record<string, string> = {
      'new': 'created',
      'verified': 'accepted',
      'in_progress': 'under_review',
      'completed': 'completed',
      'cancelled': 'rejected',
      'New': 'created',
      'Verified': 'accepted',
      'InProgress': 'under_review',
      'Completed': 'completed',
      'Cancelled': 'rejected',
      '1': 'created',
      '2': 'accepted',
      '3': 'under_review',
      '4': 'completed',
      '5': 'rejected',
    };
    const result = mapping[statusStr] || 'created';
    console.log('[OrderService] mapAssessmentStatusToOrderStatus result:', result);
    return result;
  }

  // Маппинг данных из БД в формат, который будет отправлен на фронт
  private mapLeadToOrder(lead: any) {
    try {
      const statusHistory = [] as any[];
      const realEstateObject = lead.assessment?.realEstateObject;

      // Логируем исходный статус и результат маппинга
      const rawStatus = lead.assessment?.status;
      const mappedStatus = this.mapAssessmentStatusToOrderStatus(rawStatus);
      console.log(`[OrderService] Lead ${lead.id}: rawStatus=${rawStatus} (${typeof rawStatus}), mappedStatus=${mappedStatus}`);

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
      console.error('[OrderService] Error in mapLeadToOrder for lead id:', lead?.id, error);
      throw error;
    }
  }

  async publishOrderToBitrix(orderId: string): Promise<void> {
    await this.bitrixOrderPublisher.publishOrder(orderId);
  }

  private async recordOrderCreated(lead: Lead): Promise<void> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: lead.assessmentId },
      select: { address: true },
    });
    const shortId = lead.id.length > 8 ? `#${lead.id.slice(0, 8)}` : `#${lead.id}`;
    const address = assessment?.address?.trim() || 'адрес не указан';

    await this.auditService.record({
      actorUserId: lead.applicantId, // или текущий пользователь (getCurrentUser)
      eventType: 'order.created',
      targetType: 'Order',
      targetId: lead.id,
      actionTitle: 'Создан заказ',
      actionContext: `Заказ ${shortId} создан на основе заявки`,
      targetTitle: `Заказ ${shortId}`,
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
      message: `Заказ ${shortId} создан на объект: ${address}.`,
      category: RpcNotificationCategory.ASSESSMENT,
      type: RpcNotificationType.IN_APP,
    });
  }

  private async recordOrderTaken(lead: Lead, notaryId: string): Promise<void> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: lead.assessmentId },
      select: { address: true },
    });
    const shortId = lead.id.length > 8 ? `#${lead.id.slice(0, 8)}` : `#${lead.id}`;
    const address = assessment?.address?.trim() || 'адрес не указан';

    await this.auditService.record({
      actorUserId: notaryId,
      eventType: 'order.taken',
      targetType: 'Order',
      targetId: lead.id,
      actionTitle: 'Заказ взят в работу',
      actionContext: `Нотариус взял заказ ${shortId}`,
      targetTitle: `Заказ ${shortId}`,
      targetContext: address,
      after: {
        orderId: lead.id,
        notaryId,
        takenAt: new Date().toISOString(),
      },
    });

    await this.notificationService.createInternalNotificationsForRole(PrismaRole.Admin, {
      title: 'Заказ взят в работу',
      message: `Заказ ${shortId} (${address}) взят в работу нотариусом.`,
      category: RpcNotificationCategory.ASSESSMENT,
      type: RpcNotificationType.IN_APP,
    });
  }

  async createOrder(assessmentId: string, applicantId: string): Promise<Lead> {
    const startDate = new Date();
    const plannedCompletionDate = new Date(startDate);
    plannedCompletionDate.setDate(startDate.getDate() + 7);

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

    // Аудит и уведомление
    await this.recordOrderCreated(lead);
    return lead;
  }

  async completeOrder(orderId: string, finalEstimatedValue?: string): Promise<void> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: orderId },
      include: { assessment: true },
    });
    if (!lead) throw new Error(`Order ${orderId} not found`);

    await this.prisma.lead.update({
      where: { id: orderId },
      data: { actualCompletionDate: new Date() },
    });

    await this.recordOrderCompleted(lead, finalEstimatedValue);
  }

  private async recordOrderCompleted(lead: any, finalEstimatedValue?: string): Promise<void> {
    const shortId = lead.id.length > 8 ? `#${lead.id.slice(0, 8)}` : `#${lead.id}`;
    const address = lead.assessment?.address?.trim() || 'адрес не указан';

    await this.auditService.record({
      actorUserId: getCurrentUser()?.sub,
      eventType: 'order.completed',
      targetType: 'Order',
      targetId: lead.id,
      actionTitle: 'Заказ завершён',
      actionContext: `Заказ ${shortId} завершён`,
      targetTitle: `Заказ ${shortId}`,
      targetContext: address,
      after: {
        orderId: lead.id,
        completionDate: new Date().toISOString(),
        finalEstimatedValue,
      },
    });

    await this.notificationService.createInternalNotificationsForRole(PrismaRole.Admin, {
      title: 'Заказ завершён',
      message: `Заказ ${shortId} (${address}) завершён.`,
      category: RpcNotificationCategory.ASSESSMENT,
      type: RpcNotificationType.IN_APP,
    });
  }

  async getRecentOrderEvents(userId: string, role: string, limit: number): Promise<any[]> {
    const where: any = {
      actionType: { in: ['order.created', 'order.taken', 'order.completed'] },
    };
    // Получаем ID заказов, связанных с пользователем
    let orderIds: string[] = [];
    if (role === 'applicant') {
      const leads = await this.prisma.lead.findMany({
        where: { applicantId: userId },
        select: { id: true },
      });
      orderIds = leads.map(l => l.id);
    } else if (role === 'notary') {
      const orderIds = await this.prisma.lead.findMany({
        where: {
          OR: [
            { executorId: userId },           // уже взятые текущим нотариусом заказы
            { executorId: null },             // новые заказы, ещё не взятые
          ],
        },
        select: { id: true },
      });
      if (orderIds.length === 0) return [];
      where.entityId = { in: orderIds.map(o => o.id) };
    }

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
      }) as any;
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
    return events;
  }

  // из формата фронта в формат БД
  // private mapOrderStatusToAssessmentStatus(orderStatus: string): string | undefined {
  //   console.log('[OrderService] mapOrderStatusToAssessmentStatus input:', orderStatus);
  //   const mapping: Record<string, string> = {
  //     'created': 'New',
  //     'accepted': 'Verified',
  //     'under_review': 'InProgress',
  //     'completed': 'Completed',
  //     'rejected': 'Cancelled',
  //   };
  //   const result = mapping[orderStatus];
  //   console.log('[OrderService] mapOrderStatusToAssessmentStatus output:', result);
  //   return result;
  // }
}