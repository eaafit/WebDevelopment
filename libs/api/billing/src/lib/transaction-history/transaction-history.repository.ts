import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { PrismaService } from '@internal/prisma';
import { Injectable } from '@nestjs/common';
import {
  GetPaymentHistoryResponseSchema,
  PaginationMetaSchema,
  PaymentSchema,
  PaymentStatus as RpcPaymentStatus,
  PaymentType as RpcPaymentType,
  type GetPaymentHistoryResponse,
  type Payment,
} from '@notary-portal/api-contracts';
import {
  PaymentStatus as PrismaPaymentStatus,
  PaymentType as PrismaPaymentType,
  SubscriptionPlan,
  type Prisma,
} from '@internal/prisma-client';
import type { TransactionHistoryQuery } from './transaction-history.query';

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

  async getTransactionHistory(query: TransactionHistoryQuery): Promise<GetPaymentHistoryResponse> {
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

    return create(GetPaymentHistoryResponseSchema, {
      payments: transactions.map((transaction) => this.toPaymentMessage(transaction)),
      meta: create(PaginationMetaSchema, {
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
        perPage: limit,
      }),
    });
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
        paymentDateFilter.gte = query.dateFrom;
      }

      if (query.dateTo) {
        paymentDateFilter.lte = query.dateTo;
      }

      where.paymentDate = paymentDateFilter;
    }

    if (query.searchQuery) {
      where.OR = this.buildSearchFilters(query.searchQuery);
    }

    return where;
  }

  private toPaymentMessage(transaction: TransactionRecord): Payment {
    return create(PaymentSchema, {
      id: transaction.id,
      userId: transaction.userId,
      type: this.fromPrismaType(transaction.type),
      status: this.fromPrismaStatus(transaction.status),
      paymentDate: timestampFromDate(transaction.paymentDate),
      transactionId: transaction.transactionId ?? '',
      amount: {
        amount: transaction.amount.toString(),
        currency: 'RUB',
      },
      description: this.buildDescription(transaction),
      paymentMethod: transaction.paymentMethod ?? '',
      attachmentFileName: transaction.attachmentFileName ?? '',
      attachmentFileUrl: transaction.attachmentFileUrl ?? '',
      subscriptionId: transaction.subscriptionId ?? '',
      assessmentId: transaction.assessmentId ?? '',
    });
  }

  private buildDescription(transaction: TransactionRecord): string {
    switch (transaction.type) {
      case PrismaPaymentType.Subscription: {
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

      case PrismaPaymentType.Assessment:
        return transaction.assessment?.address
          ? `Оценка недвижимости: ${transaction.assessment.address}`
          : 'Оплата оценки имущества';

      case PrismaPaymentType.DocumentCopy:
        return 'Оплата копии нотариального документа';
    }

    throw new Error(`Unsupported payment type: ${transaction.type}`);
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
        user: {
          is: {
            fullName: {
              contains: searchQuery,
              mode: 'insensitive',
            },
          },
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
      ...this.getAmountSearchFilters(searchQuery),
      ...this.getTypeSearchFilters(normalizedQuery),
      ...this.getPlanSearchFilters(normalizedQuery),
      ...this.getPaymentMethodSearchFilters(normalizedQuery),
    ];

    if (this.isUuid(searchQuery)) {
      searchFilters.unshift({
        userId: searchQuery,
      });
      searchFilters.unshift({
        id: searchQuery,
      });
    }

    return searchFilters;
  }

  private getTypeSearchFilters(searchQuery: string): Prisma.PaymentWhereInput[] {
    const filters: Prisma.PaymentWhereInput[] = [];

    if (searchQuery.includes('подпис')) {
      filters.push({ type: PrismaPaymentType.Subscription });
    }

    if (searchQuery.includes('оцен')) {
      filters.push({ type: PrismaPaymentType.Assessment });
    }

    if (searchQuery.includes('коп') || searchQuery.includes('документ')) {
      filters.push({ type: PrismaPaymentType.DocumentCopy });
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

  private getAmountSearchFilters(searchQuery: string): Prisma.PaymentWhereInput[] {
    const normalized = searchQuery
      .replace(/[^\d.,]/g, '')
      .replace(/\s+/g, '')
      .replace(',', '.');
    if (!normalized) {
      return [];
    }

    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      return [];
    }

    return [
      {
        amount: normalized,
      },
    ];
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

    throw new Error(`Unsupported subscription plan: ${plan}`);
  }

  private toPrismaStatus(status: RpcPaymentStatus): PrismaPaymentStatus {
    switch (status) {
      case RpcPaymentStatus.PENDING:
        return PrismaPaymentStatus.Pending;
      case RpcPaymentStatus.COMPLETED:
        return PrismaPaymentStatus.Completed;
      case RpcPaymentStatus.FAILED:
        return PrismaPaymentStatus.Failed;
      case RpcPaymentStatus.REFUNDED:
        return PrismaPaymentStatus.Refunded;
      case RpcPaymentStatus.UNSPECIFIED:
        throw new Error('Unsupported payment status filter: UNSPECIFIED');
    }

    throw new Error(`Unsupported payment status filter: ${status}`);
  }

  private fromPrismaStatus(status: PrismaPaymentStatus): RpcPaymentStatus {
    switch (status) {
      case PrismaPaymentStatus.Pending:
        return RpcPaymentStatus.PENDING;
      case PrismaPaymentStatus.Completed:
        return RpcPaymentStatus.COMPLETED;
      case PrismaPaymentStatus.Failed:
        return RpcPaymentStatus.FAILED;
      case PrismaPaymentStatus.Refunded:
        return RpcPaymentStatus.REFUNDED;
    }

    throw new Error(`Unsupported payment status: ${status}`);
  }

  private toPrismaType(type: RpcPaymentType): PrismaPaymentType {
    switch (type) {
      case RpcPaymentType.SUBSCRIPTION:
        return PrismaPaymentType.Subscription;
      case RpcPaymentType.ASSESSMENT:
        return PrismaPaymentType.Assessment;
      case RpcPaymentType.DOCUMENT_COPY:
        return PrismaPaymentType.DocumentCopy;
      case RpcPaymentType.UNSPECIFIED:
        throw new Error('Unsupported payment type filter: UNSPECIFIED');
    }

    throw new Error(`Unsupported payment type filter: ${type}`);
  }

  private fromPrismaType(type: PrismaPaymentType): RpcPaymentType {
    switch (type) {
      case PrismaPaymentType.Subscription:
        return RpcPaymentType.SUBSCRIPTION;
      case PrismaPaymentType.Assessment:
        return RpcPaymentType.ASSESSMENT;
      case PrismaPaymentType.DocumentCopy:
        return RpcPaymentType.DOCUMENT_COPY;
    }

    throw new Error(`Unsupported payment type: ${type}`);
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
