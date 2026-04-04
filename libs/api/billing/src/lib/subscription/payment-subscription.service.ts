import { create } from '@bufbuild/protobuf';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  CreateSubscriptionResponseSchema,
  GetSubscriptionResponseSchema,
  SubscriptionSchema,
  type CreateSubscriptionRequest,
  type CreateSubscriptionResponse,
  type GetSubscriptionRequest,
  type GetSubscriptionResponse,
} from '@notary-portal/api-contracts';
import { PrismaService } from '@internal/prisma';
import { Prisma, type Subscription as PrismaSubscriptionRecord } from '@internal/prisma-client';
import { Injectable } from '@nestjs/common';
import {
  SUBSCRIPTION_CURRENCY,
  addSubscriptionMonths,
  getSubscriptionPlanByPrisma,
  getSubscriptionPlanByRpc,
} from './subscription-plan.catalog';

type PrismaTransaction = Prisma.TransactionClient;

@Injectable()
export class PaymentSubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSubscription(
    request: CreateSubscriptionRequest,
  ): Promise<CreateSubscriptionResponse> {
    const plan = getSubscriptionPlanByRpc(request.plan);
    const startDate = request.startDate
      ? normalizeDate(timestampDate(request.startDate))
      : new Date();
    const endDate = request.endDate
      ? normalizeDate(timestampDate(request.endDate))
      : normalizeDate(addSubscriptionMonths(startDate, plan.durationMonths));

    if (endDate <= startDate) {
      throw new ConnectError('endDate must be later than startDate', Code.InvalidArgument);
    }

    const subscription = await this.prisma.subscription.create({
      data: {
        userId: request.userId,
        plan: plan.prismaPlan,
        basePrice: plan.price,
        currency: SUBSCRIPTION_CURRENCY,
        startDate,
        endDate,
        isActive: false,
      },
    });

    return create(CreateSubscriptionResponseSchema, {
      subscription: this.toRpcSubscription(subscription),
    });
  }

  async getSubscription(request: GetSubscriptionRequest): Promise<GetSubscriptionResponse> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId: request.userId,
        isActive: true,
      },
      orderBy: [{ endDate: 'desc' }, { startDate: 'desc' }, { id: 'desc' }],
    });

    return create(GetSubscriptionResponseSchema, {
      subscription: subscription ? this.toRpcSubscription(subscription) : undefined,
    });
  }

  async resolveSubscriptionForPayment(
    subscriptionId: string,
    userId: string,
  ): Promise<PrismaSubscriptionRecord> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || subscription.userId !== userId) {
      throw new ConnectError('Subscription was not found', Code.NotFound);
    }

    if (subscription.isActive) {
      throw new ConnectError('Subscription is already active', Code.FailedPrecondition);
    }

    return subscription;
  }

  async activateSubscription(tx: PrismaTransaction, subscriptionId: string): Promise<void> {
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: { isActive: true },
    });
  }

  private toRpcSubscription(subscription: PrismaSubscriptionRecord) {
    const plan = getSubscriptionPlanByPrisma(subscription.plan);
    return create(SubscriptionSchema, {
      id: subscription.id,
      userId: subscription.userId,
      plan: plan.rpcPlan,
      isActive: subscription.isActive,
      startDate: timestampFromDate(subscription.startDate),
      endDate: timestampFromDate(subscription.endDate),
    });
  }
}

function normalizeDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
