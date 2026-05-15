import { PaymentType as PrismaPaymentType, Prisma } from '@internal/prisma-client';

export interface PaymentAuditTargetInput {
  id: string;
  type?: PrismaPaymentType | null;
  subscriptionId?: string | null;
  assessmentId?: string | null;
}

export interface PaymentAuditSnapshotInput extends PaymentAuditTargetInput {
  amount?: unknown;
  discountAmount?: unknown;
  status?: unknown;
  transactionId?: string | null;
  paymentMethod?: string | null;
  receiptStatus?: unknown;
  attachmentFileName?: string | null;
  attachmentFileUrl?: string | null;
  promoId?: string | null;
}

export function buildPaymentAuditTarget(payment: PaymentAuditTargetInput): {
  targetType: string;
  targetId: string;
  targetTitle: string;
  targetContext: string;
} {
  if (payment.assessmentId) {
    return {
      targetType: 'Assessment',
      targetId: payment.assessmentId,
      targetTitle: `Заявка ${shortId(payment.assessmentId)}`,
      targetContext: `Платёж ${shortId(payment.id)}`,
    };
  }

  return {
    targetType: 'Payment',
    targetId: payment.id,
    targetTitle: `Платёж ${shortId(payment.id)}`,
    targetContext: buildPaymentTargetContext(payment),
  };
}

export function buildPaymentAuditSnapshot(
  payment: PaymentAuditSnapshotInput,
  extra: Record<string, Prisma.JsonValue | undefined> = {},
): Prisma.JsonObject {
  return compactRecord({
    paymentId: payment.id,
    type: payment.type ?? undefined,
    status: stringifyValue(payment.status),
    amount: stringifyValue(payment.amount),
    discountAmount: stringifyValue(payment.discountAmount),
    transactionId: payment.transactionId,
    paymentMethod: payment.paymentMethod,
    receiptStatus: stringifyValue(payment.receiptStatus),
    attachmentFileName: payment.attachmentFileName,
    hasAttachment: Boolean(payment.attachmentFileUrl?.trim()),
    subscriptionId: payment.subscriptionId,
    assessmentId: payment.assessmentId,
    promoId: payment.promoId,
    ...extra,
  });
}

export function buildPaymentActionContext(payment: PaymentAuditSnapshotInput): string {
  const amount = stringifyValue(payment.amount);
  const typeLabel = getPaymentTypeLabel(payment.type);

  return amount ? `${typeLabel}. Сумма: ${amount} RUB` : typeLabel;
}

export function getPaymentTypeLabel(type?: PrismaPaymentType | null): string {
  switch (type) {
    case PrismaPaymentType.Subscription:
      return 'Оплата подписки';
    case PrismaPaymentType.Assessment:
      return 'Оплата оценки';
    case PrismaPaymentType.DocumentCopy:
      return 'Оплата копии документа';
    default:
      return 'Платёж';
  }
}

export function shortId(value: string): string {
  return value.length > 8 ? `#${value.slice(0, 8)}` : `#${value}`;
}

function buildPaymentTargetContext(payment: PaymentAuditTargetInput): string {
  if (payment.subscriptionId) {
    return `Подписка ${shortId(payment.subscriptionId)}`;
  }

  if (payment.type === PrismaPaymentType.DocumentCopy) {
    return 'Копия нотариального документа';
  }

  return 'Без заявки';
}

function compactRecord(value: Record<string, Prisma.JsonValue | undefined>): Prisma.JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) => entry !== undefined && entry !== null && entry !== '',
    ),
  ) as Prisma.JsonObject;
}

function stringifyValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return String(value);
}
