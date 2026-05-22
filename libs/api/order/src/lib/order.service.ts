import { Injectable } from '@nestjs/common';
import { PrismaService } from '@notary-portal/api/prisma';

@Injectable()
export class OrderService {
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
    const { userId, role, status, searchQuery, dateFrom, dateTo, page, pageSize } = params;
    const where: any = {};

    if (role === 'applicant') {
      where.applicantId = userId;
    } else if (role === 'notary') {
      where.executorId = userId;
    }

    if (status && status !== 'all') {
      where.assessment = { status };
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
        { assessment: { address: { contains: searchQuery, mode: 'insensitive' } } }
      ];
    }

    // Получаем общее количество записей для пагинации
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
            statusHistory: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    const orders = leads.map(this.mapLeadToOrder);
    return { orders, total, totalPages: Math.ceil(total / pageSize) };
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
            statusHistory: true,
          },
        },
      },
    });
    if (!lead) throw new Error('Order not found');
    return this.mapLeadToOrder(lead);
  }

  // Маппинг данных из БД в формат, который будет отправлен на фронт
  private mapLeadToOrder(lead: any) {
    const statusHistory = lead.assessment.statusHistory.map(entry => ({
      status: entry.status,
      date: entry.createdAt,
      comment: entry.comment,
    }));

    const realEstateObject = lead.assessment.realEstateObject;

    return {
      id: lead.id,
      objectAddress: lead.assessment.address,
      orderDate: lead.startDate,
      status: lead.assessment.status,
      totalAmount: lead.assessment.estimatedValue,
      statusHistory,
      applicantId: lead.applicant.id,
      applicantName: lead.applicant.fullName,
      notaryId: lead.executor?.id,
      notaryName: lead.executor?.fullName,
      plannedCompletionDate: lead.plannedCompletionDate,
      actualCompletionDate: lead.actualCompletionDate,
      transactionId: lead.transactionId,
      realEstateObject: {
        id: realEstateObject.id,
        address: realEstateObject.address,
        city: realEstateObject.city,
        area: realEstateObject.area,
        objectType: realEstateObject.objectType,
        roomsCount: realEstateObject.roomsCount,
        floor: realEstateObject.floor,
      },
    };
  }
}