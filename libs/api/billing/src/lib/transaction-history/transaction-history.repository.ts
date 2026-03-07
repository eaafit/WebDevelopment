import {
  type TransactionHistoryItem,
  type TransactionHistoryQuery,
  type TransactionHistoryResponse,
  type TransactionHistoryStatus,
  type TransactionHistoryType,
} from '@notary-portal/api-contracts';
import { PrismaService } from '@internal/prisma';
import { Injectable } from '@nestjs/common';
import { PaymentStatus, PaymentType, SubscriptionPlan, type Prisma } from '@internal/prisma-client';

type TransactionRecord = Prisma.PaymentGetPayload<{
  include: {
    subscription: true;
    assessment: {
      select: {
        id: true;
        address: true;
      };
    };
  };
}>;

@Injectable()
export class TransactionHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getTransactionHistory(query: TransactionHistoryQuery): Promise<TransactionHistoryResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = this.buildWhere(query);

    const [totalItems, transactions] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: {
          subscription: true,
          assessment: {
            select: {
              id: true,
              address: true,
            },
          },
        },
        orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      transactions: transactions.map((transaction) => this.toHistoryItem(transaction)),
      meta: {
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
        perPage: limit,
      },
    };
  }

  private buildWhere(query: TransactionHistoryQuery): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.statuses?.length) {
      where.status = {
        in: query.statuses.map((status) => this.toPrismaStatus(status)),
      };
    }

    if (query.types?.length) {
      where.type = {
        in: query.types.map((type) => this.toPrismaType(type)),
      };
    }

    if (query.dateFrom || query.dateTo) {
      const paymentDateFilter: Prisma.DateTimeFilter = {};

      if (query.dateFrom) {
        paymentDateFilter.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
      }

      if (query.dateTo) {
        paymentDateFilter.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
      }

      where.paymentDate = paymentDateFilter;
    }

    if (query.searchQuery) {
      where.OR = this.buildSearchFilters(query.searchQuery);
    }

    return where;
  }

  private toHistoryItem(transaction: TransactionRecord): TransactionHistoryItem {
    return {
      id: transaction.id,
      userId: transaction.userId,
      type: this.fromPrismaType(transaction.type),
      status: this.fromPrismaStatus(transaction.status),
      paymentDate: transaction.paymentDate.toISOString(),
      transactionId: transaction.transactionId,
      amount: transaction.amount.toString(),
      currency: 'RUB',
      description: this.buildDescription(transaction),
      paymentMethod: transaction.paymentMethod,
      attachmentFileName: transaction.attachmentFileName,
      attachmentFileUrl: transaction.attachmentFileUrl,
      subscriptionId: transaction.subscriptionId,
      assessmentId: transaction.assessmentId,
    };
  }

  private buildDescription(transaction: TransactionRecord): string {
    switch (transaction.type) {
      case PaymentType.Subscription: {
        if (!transaction.subscription) {
          return 'Оплата подписки';
        }

        const plan = this.humanizeSubscriptionPlan(transaction.subscription.plan);
        const durationDays = this.getDurationDays(
          transaction.subscription.startDate,
          transaction.subscription.endDate,
        );

        return durationDays ? `Подписка ${plan} (${durationDays} дней)` : `Подписка ${plan}`;
      }

      case PaymentType.Assessment:
        return transaction.assessment?.address
          ? `Оценка недвижимости: ${transaction.assessment.address}`
          : 'Оплата оценки имущества';

      case PaymentType.DocumentCopy:
        return 'Оплата копии нотариального документа';
    }
  }

  private buildSearchFilters(searchQuery: string): Prisma.PaymentWhereInput[] {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searchFilters: Prisma.PaymentWhereInput[] = [
      {
        transactionId: {
          contains: searchQuery,
          mode: 'insensitive',
        },
      },
      {
        paymentMethod: {
          contains: searchQuery,
          mode: 'insensitive',
        },
      },
      {
        attachmentFileName: {
          contains: searchQuery,
          mode: 'insensitive',
        },
      },
      {
        assessment: {
          is: {
            address: {
              contains: searchQuery,
              mode: 'insensitive',
            },
          },
        },
      },
      ...this.getTypeSearchFilters(normalizedQuery),
      ...this.getPlanSearchFilters(normalizedQuery),
      ...this.getPaymentMethodSearchFilters(normalizedQuery),
    ];

    if (this.isUuid(searchQuery)) {
      searchFilters.unshift({
        id: searchQuery,
      });
    }

    return searchFilters;
  }

  private getTypeSearchFilters(searchQuery: string): Prisma.PaymentWhereInput[] {
    const filters: Prisma.PaymentWhereInput[] = [];

    if (searchQuery.includes('подпис')) {
      filters.push({ type: PaymentType.Subscription });
    }

    if (searchQuery.includes('оцен')) {
      filters.push({ type: PaymentType.Assessment });
    }

    if (searchQuery.includes('коп') || searchQuery.includes('документ')) {
      filters.push({ type: PaymentType.DocumentCopy });
    }

    return filters;
  }

  private getPlanSearchFilters(searchQuery: string): Prisma.PaymentWhereInput[] {
    const planAliases: Array<[SubscriptionPlan, string[]]> = [
      [SubscriptionPlan.Basic, ['basic', 'баз', 'старт']],
      [SubscriptionPlan.Premium, ['premium', 'премиум']],
      [SubscriptionPlan.Enterprise, ['enterprise', 'энтерпрайз', 'корпорат']],
    ];

    return planAliases
      .filter(([, aliases]) => aliases.some((alias) => searchQuery.includes(alias)))
      .map(([plan]) => ({
        subscription: {
          is: {
            plan,
          },
        },
      }));
  }

  private getPaymentMethodSearchFilters(searchQuery: string): Prisma.PaymentWhereInput[] {
    const methodAliases: Array<[string, string[]]> = [
      ['sbp', ['sbp', 'сбп', 'быстрых платеж']],
      ['bank_card', ['bank_card', 'карта', 'картой', 'visa', 'mastercard', 'mir']],
      ['invoice', ['invoice', 'счет', 'счёт', 'реквизит']],
      ['bank_transfer', ['bank_transfer', 'перевод', 'банк']],
      ['cash', ['cash', 'налич']],
      ['apple_pay', ['apple pay']],
      ['google_pay', ['google pay']],
      ['mir_pay', ['mir pay', 'мир pay']],
      ['sber_pay', ['sber pay', 'sberpay', 'сбер']],
    ];

    return methodAliases
      .filter(([, aliases]) => aliases.some((alias) => searchQuery.includes(alias)))
      .map(([method]) => ({
        paymentMethod: method,
      }));
  }

  private getDurationDays(startDate: Date, endDate: Date): number | null {
    const durationMs = endDate.getTime() - startDate.getTime();
    if (durationMs < 0) {
      return null;
    }

    return Math.max(1, Math.ceil(durationMs / 86_400_000));
  }

  private humanizeSubscriptionPlan(plan: SubscriptionPlan): string {
    switch (plan) {
      case SubscriptionPlan.Basic:
        return 'Basic';
      case SubscriptionPlan.Premium:
        return 'Premium';
      case SubscriptionPlan.Enterprise:
        return 'Enterprise';
    }
  }

  private toPrismaStatus(status: TransactionHistoryStatus): PaymentStatus {
    switch (status) {
      case 'pending':
        return PaymentStatus.Pending;
      case 'completed':
        return PaymentStatus.Completed;
      case 'failed':
        return PaymentStatus.Failed;
      case 'refunded':
        return PaymentStatus.Refunded;
    }
  }

  private fromPrismaStatus(status: PaymentStatus): TransactionHistoryStatus {
    switch (status) {
      case PaymentStatus.Pending:
        return 'pending';
      case PaymentStatus.Completed:
        return 'completed';
      case PaymentStatus.Failed:
        return 'failed';
      case PaymentStatus.Refunded:
        return 'refunded';
    }
  }

  private toPrismaType(type: TransactionHistoryType): PaymentType {
    switch (type) {
      case 'subscription':
        return PaymentType.Subscription;
      case 'assessment':
        return PaymentType.Assessment;
      case 'document_copy':
        return PaymentType.DocumentCopy;
    }
  }

  private fromPrismaType(type: PaymentType): TransactionHistoryType {
    switch (type) {
      case PaymentType.Subscription:
        return 'subscription';
      case PaymentType.Assessment:
        return 'assessment';
      case PaymentType.DocumentCopy:
        return 'document_copy';
    }
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
