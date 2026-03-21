import { SubscriptionPlan } from '@notary-portal/api-contracts';

export type SubscriptionPlanCode = 'basic' | 'premium' | 'enterprise';

export interface SubscriptionPlanViewModel {
  code: SubscriptionPlanCode;
  rpcPlan: SubscriptionPlan;
  title: string;
  subtitle: string;
  price: string;
  periodLabel: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlanViewModel[] = [
  {
    code: 'basic',
    rpcPlan: SubscriptionPlan.BASIC,
    title: 'Базовый',
    subtitle: 'Для старта и небольшого потока заявок',
    price: '1500.00',
    periodLabel: '1 месяц',
    features: ['До 10 заявок в месяц', 'Стандартная поддержка', 'История платежей'],
  },
  {
    code: 'premium',
    rpcPlan: SubscriptionPlan.PREMIUM,
    title: 'Премиум',
    subtitle: 'Для активной практики и командной работы',
    price: '5000.00',
    periodLabel: '1 месяц',
    features: ['Безлимитные заявки', 'Приоритетная поддержка', 'API и расширенная аналитика'],
  },
  {
    code: 'enterprise',
    rpcPlan: SubscriptionPlan.ENTERPRISE,
    title: 'Корпоративный',
    subtitle: 'Для крупных бюро и распределённых команд',
    price: '12000.00',
    periodLabel: '1 месяц',
    features: [
      'Многопользовательский доступ',
      'Персональный менеджер',
      'Индивидуальные сценарии интеграции',
    ],
  },
] as const;

export function resolveSubscriptionPlan(
  code: string | null | undefined,
): SubscriptionPlanViewModel {
  const plan = SUBSCRIPTION_PLANS.find((entry) => entry.code === code);
  return plan ?? SUBSCRIPTION_PLANS[0];
}

export function formatPrice(amount: string, currency = 'RUB'): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}
