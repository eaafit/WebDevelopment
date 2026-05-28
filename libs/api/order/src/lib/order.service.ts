import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) { }

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
    const { userId, role, status, searchQuery, dateFrom, dateTo, page, pageSize } = params;
    const where: any = {};

    if (role === 'applicant') {
      where.applicantId = userId;
    }
    // } else if (role === 'notary') {
    //   where.executorId = userId;
    // }

    if (status && status !== 'all') {
      // Пытаемся преобразовать статус в число, если это возможно (т.к. в БД статус хранится как число)
      let statusValue: any = status;
      if (!isNaN(Number(status))) {
        statusValue = Number(status);
      }
      where.assessment = { status: statusValue };
    }
    if (dateFrom) {
      where.startDate = { gte: dateFrom };
    }
    if (dateTo) {
      where.startDate = { lte: dateTo };
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

  private mapAssessmentStatusToOrderStatus(assessmentStatus: string | number | undefined): string {
    // Если статус пришёл как число, преобразуем в строку (на всякий случай)
    const statusStr = assessmentStatus?.toString() ?? '';
    const mapping: Record<string, string> = {
      'NEW': 'created',
      'VERIFIED': 'accepted',
      'IN_PROGRESS': 'under_review',
      'COMPLETED': 'completed',
      'CANCELLED': 'rejected',
    };
    return mapping[statusStr] || 'created'; // по умолчанию 'created'
  }

  // Маппинг данных из БД в формат, который будет отправлен на фронт
  private mapLeadToOrder(lead: any) {
    try {
      const statusHistory = [] as any[]; // пока пустая

      const realEstateObject = lead.assessment?.realEstateObject;

      // Защита от отсутствия realEstateObject
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
        objectAddress: lead.assessment?.address || '',
        orderDate: lead.startDate,
        status: this.mapAssessmentStatusToOrderStatus(lead.assessment?.status),
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
}