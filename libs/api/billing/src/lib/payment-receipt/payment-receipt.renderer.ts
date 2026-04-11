import {
  PaymentType,
  SubscriptionPlan,
  type Assessment,
  type Payment,
  type Subscription,
  type User,
} from '@internal/prisma-client';
import type { YooKassaPaymentDetails } from '../yookassa/yookassa.client';

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

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Чек оплаты</title>
  <style>
    :root {
      color-scheme: light;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    body {
      margin: 0;
      padding: 32px;
      background: #f3f5f7;
      color: #102030;
    }
    .receipt {
      max-width: 760px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 16px 48px rgba(16, 32, 48, 0.12);
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: start;
      margin-bottom: 24px;
    }
    .title {
      margin: 0 0 8px;
      font-size: 28px;
      line-height: 1.1;
    }
    .subtitle,
    .note {
      margin: 0;
      color: #556677;
    }
    .header-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }
    .action-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 14px;
      border: none;
      border-radius: 999px;
      color: #ffffff;
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      background: #102030;
      box-shadow: 0 10px 20px rgba(16, 32, 48, 0.18);
    }
    .action-button:hover {
      background: #18324b;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .card {
      padding: 16px;
      border-radius: 16px;
      background: #f8fafc;
      border: 1px solid #e4ebf2;
    }
    .label {
      display: block;
      margin-bottom: 6px;
      color: #64748b;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .value {
      font-size: 16px;
      font-weight: 600;
      word-break: break-word;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      overflow: hidden;
      border-radius: 16px;
      border: 1px solid #e4ebf2;
    }
    th,
    td {
      padding: 14px 16px;
      text-align: left;
      border-bottom: 1px solid #e4ebf2;
      vertical-align: top;
    }
    th {
      background: #f8fafc;
      color: #64748b;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .summary {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
    .summary-card {
      min-width: 240px;
      padding: 16px 20px;
      border-radius: 16px;
      background: #102030;
      color: #ffffff;
    }
    .summary-card strong {
      display: block;
      margin-top: 6px;
      font-size: 24px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e4ebf2;
    }
    @media (max-width: 720px) {
      body {
        padding: 16px;
      }
      .receipt {
        padding: 20px;
      }
      .header,
      .grid,
      .summary {
        display: block;
      }
      .grid .card,
      .summary-card {
        margin-bottom: 12px;
      }
    }
    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }
      .receipt {
        max-width: none;
        border-radius: 0;
        box-shadow: none;
      }
      .action-button {
        display: none;
      }
    }
  </style>
</head>
<body>
  <main class="receipt">
    <section class="header">
      <div>
        <h1 class="title">Чек оплаты</h1>
        <p class="subtitle">Документ по подтвержденной оплате в системе.</p>
      </div>
      <div class="header-actions">
        <button type="button" class="action-button" onclick="window.print()">Сохранить в PDF</button>
      </div>
    </section>

    <section class="grid">
      <article class="card">
        <span class="label">Нотариус</span>
        <span class="value">${escapeHtml(input.user.fullName || 'Не указано')}</span>
      </article>
      <article class="card">
        <span class="label">Email</span>
        <span class="value">${escapeHtml(input.user.email || 'Не указан')}</span>
      </article>
      <article class="card">
        <span class="label">Дата оплаты</span>
        <span class="value">${escapeHtml(formatDateTime(paidAt))}</span>
      </article>
      <article class="card">
        <span class="label">Способ оплаты</span>
        <span class="value">${escapeHtml(paymentMethod)}</span>
      </article>
    </section>

    <table>
      <thead>
        <tr>
          <th>Описание</th>
          <th>Количество</th>
          <th>Сумма</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(description)}</td>
          <td>1</td>
          <td>${escapeHtml(amount)}</td>
        </tr>
      </tbody>
    </table>

    <section class="summary">
      <div class="summary-card">
        Итого
        <strong>${escapeHtml(amount)}</strong>
      </div>
    </section>

    <footer class="footer">
      <p class="note">
        Документ сформирован автоматически после подтверждения оплаты.
      </p>
    </footer>
  </main>
</body>
</html>`;

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
