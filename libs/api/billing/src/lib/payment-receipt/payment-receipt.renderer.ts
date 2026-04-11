import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PaymentType,
  SubscriptionPlan,
  type Assessment,
  type Payment,
  type Subscription,
  type User,
} from '@internal/prisma-client';
import type { YooKassaPaymentDetails } from '../yookassa/yookassa.client';

const RECEIPT_TEMPLATE_FILE_NAME = 'payment-receipt.template.html';
const RECEIPT_TEMPLATE = loadReceiptTemplate();

interface RenderReceiptPayment
  extends Pick<
    Payment,
    'id' | 'userId' | 'type' | 'paymentDate' | 'paymentMethod' | 'transactionId'
  > {
  amount: string;
}

type RenderReceiptUser = Pick<User, 'email' | 'fullName'>;

type RenderReceiptSubscription = Pick<Subscription, 'plan'>;

type RenderReceiptAssessment = Pick<Assessment, 'address'>;

export interface RenderPaymentReceiptInput {
  payment: RenderReceiptPayment;
  user: RenderReceiptUser;
  subscription: RenderReceiptSubscription | null;
  assessment: RenderReceiptAssessment | null;
  providerPayment: YooKassaPaymentDetails;
}

export function buildStoredPaymentReceiptObjectKey(userId: string, paymentId: string): string {
  return `payment-documents/receipts/${userId}/${paymentId}/yookassa-receipt.html`;
}

export function buildStoredPaymentReceiptFileName(
  paymentId: string,
  transactionId?: string | null,
): string {
  const suffix = (transactionId ?? paymentId).replace(/[^a-zA-Z0-9._-]+/g, '-');
  return `receipt-${suffix}.html`;
}

export function renderStoredPaymentReceipt(input: RenderPaymentReceiptInput): Buffer {
  const amount = formatMoney(input.payment.amount);
  const paidAt = input.providerPayment.capturedAt ?? input.providerPayment.createdAt;
  const description = resolveDescription(input.payment.type, input.subscription, input.assessment);
  const paymentMethod = humanizePaymentMethod(
    input.providerPayment.paymentMethodTitle ?? input.providerPayment.paymentMethodType,
  );

  const html = renderReceiptTemplate({
    notaryName: escapeHtml(input.user.fullName || 'Не указано'),
    email: escapeHtml(input.user.email || 'Не указан'),
    paidAt: escapeHtml(formatDateTime(paidAt)),
    paymentMethod: escapeHtml(paymentMethod),
    description: escapeHtml(description),
    amount: escapeHtml(amount),
  });

  return Buffer.from(html, 'utf8');
}

function resolveDescription(
  paymentType: PaymentType,
  subscription: RenderReceiptSubscription | null,
  assessment: RenderReceiptAssessment | null,
): string {
  switch (paymentType) {
    case PaymentType.Subscription:
      return subscription ? `Подписка ${humanizePlan(subscription.plan)}` : 'Оплата подписки';
    case PaymentType.Assessment:
      return assessment?.address
        ? `Оценка недвижимости: ${assessment.address}`
        : 'Оплата оценки имущества';
    case PaymentType.DocumentCopy:
      return 'Оплата копии нотариального документа';
  }
}

function humanizePlan(plan: SubscriptionPlan): string {
  switch (plan) {
    case SubscriptionPlan.Basic:
      return 'Basic';
    case SubscriptionPlan.Premium:
      return 'Premium';
    case SubscriptionPlan.Enterprise:
      return 'Enterprise';
  }
}

function humanizePaymentMethod(value: string | null): string {
  if (!value) {
    return 'Не указан';
  }

  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function formatMoney(value: string): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return value;
  }

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Не указана';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function loadReceiptTemplate(): string {
  const candidatePaths = [
    resolve(process.cwd(), 'libs/api/billing/src/lib/payment-receipt', RECEIPT_TEMPLATE_FILE_NAME),
    resolve(__dirname, RECEIPT_TEMPLATE_FILE_NAME),
  ];

  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath)) {
      return readFileSync(candidatePath, 'utf8');
    }
  }

  throw new Error(`Payment receipt template was not found. Checked: ${candidatePaths.join(', ')}`);
}

function renderReceiptTemplate(placeholders: Record<string, string>): string {
  let html = RECEIPT_TEMPLATE;

  for (const [name, value] of Object.entries(placeholders)) {
    html = html.replaceAll(`{{${name}}}`, value);
  }

  return html;
}
