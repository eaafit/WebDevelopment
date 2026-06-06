import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { getCurrentUser } from '@internal/auth-shared';
import {
  BusinessOperations,
  NotarySpanAttributes,
  normalizeSpanActorRole,
  runInSpan,
  setSpanAttributes,
} from '@internal/tracing';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(private prisma: PrismaService) {}

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
      async (span) =>
        this.prisma.$transaction(async (tx) => {
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
          return this.mapLeadToOrder(updatedLead);
        }),
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
