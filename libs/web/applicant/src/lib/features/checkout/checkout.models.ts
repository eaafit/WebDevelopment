import { PaymentType } from '@notary-portal/api-contracts';

export type ApplicantCheckoutServiceCode = 'assessment' | 'document_copy';

export interface ApplicantCheckoutServiceViewModel {
  code: ApplicantCheckoutServiceCode;
  rpcType: PaymentType;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  badge: string;
  targetLabel: string;
  targetAliases: readonly string[];
  successMessage: string;
}

export const APPLICANT_CHECKOUT_SERVICES: readonly ApplicantCheckoutServiceViewModel[] = [
  {
    code: 'assessment',
    rpcType: PaymentType.ASSESSMENT,
    title: 'Нотариальная оценка имущества',
    subtitle: 'Подготовка и сопровождение оценки объекта для дальнейшего оформления.',
    description:
      'Платёж подтверждает заказ услуги оценки. После оплаты заявка перейдёт в следующий этап обработки.',
    price: '2500.00',
    badge: 'Оценка',
    targetLabel: 'ID оценки',
    targetAliases: ['assessmentId', 'targetId'],
    successMessage:
      'Платёж по услуге оценки подтверждён. Дальнейшая обработка будет выполнена отдельной бизнес-логикой.',
  },
  {
    code: 'document_copy',
    rpcType: PaymentType.DOCUMENT_COPY,
    title: 'Копия нотариального документа',
    subtitle: 'Подготовка заверенной копии документа по вашему запросу.',
    description:
      'После подтверждения оплаты запрос на выдачу копии будет передан в дальнейшую обработку.',
    price: '900.00',
    badge: 'Копия',
    targetLabel: 'ID запроса',
    targetAliases: ['documentId', 'targetId'],
    successMessage:
      'Платёж за копию документа подтверждён. Дальнейшая обработка будет выполнена отдельной бизнес-логикой.',
  },
] as const;

export function resolveApplicantCheckoutService(
  code: ApplicantCheckoutServiceCode,
): ApplicantCheckoutServiceViewModel {
  const service = APPLICANT_CHECKOUT_SERVICES.find((entry) => entry.code === code);
  return service ?? APPLICANT_CHECKOUT_SERVICES[0];
}

export function resolveApplicantCheckoutServiceCode(
  rawValue: string | null | undefined,
): ApplicantCheckoutServiceCode {
  const normalized = rawValue?.trim().toLowerCase();
  return normalized === 'document_copy' ? 'document_copy' : 'assessment';
}

export function resolveCheckoutAmount(
  rawValue: string | null | undefined,
  fallback: string,
): string {
  const normalized = rawValue?.trim() ?? '';
  if (!normalized) {
    return fallback;
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    return fallback;
  }

  return amount.toFixed(2);
}

export function formatPrice(value: string | null | undefined): string {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return '0 ₽';
  }

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
