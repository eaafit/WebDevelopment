import { Code, ConnectError } from '@connectrpc/connect';
import { SubscriptionPlan as RpcSubscriptionPlan } from '@notary-portal/api-contracts';
import { SubscriptionPlan as PrismaSubscriptionPlan } from '@internal/prisma-client';

export const SUBSCRIPTION_CURRENCY = 'RUB';

export interface SubscriptionPlanCatalogEntry {
  rpcPlan: RpcSubscriptionPlan;
  prismaPlan: PrismaSubscriptionPlan;
  code: 'basic' | 'premium' | 'enterprise';
  title: string;
  price: string;
  durationMonths: number;
}

const PLAN_CATALOG: readonly SubscriptionPlanCatalogEntry[] = [
  {
    rpcPlan: RpcSubscriptionPlan.BASIC,
    prismaPlan: PrismaSubscriptionPlan.Basic,
    code: 'basic',
    title: 'Базовый',
    price: '1500.00',
    durationMonths: 1,
  },
  {
    rpcPlan: RpcSubscriptionPlan.PREMIUM,
    prismaPlan: PrismaSubscriptionPlan.Premium,
    code: 'premium',
    title: 'Премиум',
    price: '5000.00',
    durationMonths: 1,
  },
  {
    rpcPlan: RpcSubscriptionPlan.ENTERPRISE,
    prismaPlan: PrismaSubscriptionPlan.Enterprise,
    code: 'enterprise',
    title: 'Корпоративный',
    price: '12000.00',
    durationMonths: 1,
  },
] as const;

export function getSubscriptionPlanByRpc(plan: RpcSubscriptionPlan): SubscriptionPlanCatalogEntry {
  const match = PLAN_CATALOG.find((entry) => entry.rpcPlan === plan);
  if (!match) {
    throw new ConnectError(`Unsupported subscription plan: ${plan}`, Code.InvalidArgument);
  }
  return match;
}

export function getSubscriptionPlanByPrisma(
  plan: PrismaSubscriptionPlan,
): SubscriptionPlanCatalogEntry {
  const match = PLAN_CATALOG.find((entry) => entry.prismaPlan === plan);
  if (!match) {
    throw new ConnectError(`Unsupported subscription plan: ${plan}`, Code.InvalidArgument);
  }
  return match;
}

export function addSubscriptionMonths(startDate: Date, months: number): Date {
  const targetMonthStart = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + months, 1),
  );
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();

  return new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth(),
      Math.min(startDate.getUTCDate(), lastDayOfTargetMonth),
    ),
  );
}
