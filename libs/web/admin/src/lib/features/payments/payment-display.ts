import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  type Payment,
} from './payments.shared';

export const PAYMENT_EMPTY_VALUE = '\u2014';
export const PAYMENT_DEFAULT_LOCALE = 'ru-RU';
export const PAYMENT_DEFAULT_CURRENCY = 'RUB';

export type PaymentRelationKind = 'assessment' | 'subscription' | 'none';
export type PaymentReceiptState = 'available' | 'missing-url' | 'missing-file' | 'missing';
export type PaymentRiskTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface PaymentRelationSummary {
  kind: PaymentRelationKind;
  id: string | null;
  csvValue: string;
  shortLabel: string;
  filterValue: string;
}

export interface PaymentReceiptSummary {
  state: PaymentReceiptState;
  fileName: string;
  canOpen: boolean;
  canDownload: boolean;
  csvValue: string;
}

export interface PaymentSearchSnapshot {
  id: string;
  payer: string;
  type: string;
  status: string;
  method: string;
  transactionId: string;
  relation: string;
  receipt: string;
}

export function formatPaymentMoney(
  amount: number | null | undefined,
  currency = PAYMENT_DEFAULT_CURRENCY,
  locale = PAYMENT_DEFAULT_LOCALE,
): string {
  const normalizedAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const normalizedCurrency = currency?.trim() || PAYMENT_DEFAULT_CURRENCY;
  return `${getPaymentNumberFormatter(locale).format(normalizedAmount)} ${normalizedCurrency}`;
}

export function formatPaymentFee(
  fee: number | null | undefined,
  locale = PAYMENT_DEFAULT_LOCALE,
): string {
  const normalizedFee = Number.isFinite(Number(fee)) ? Number(fee) : 0;
  return getPaymentNumberFormatter(locale).format(normalizedFee);
}

export function formatPaymentDateTime(
  value: string | null | undefined,
  locale = PAYMENT_DEFAULT_LOCALE,
): string {
  if (!value) {
    return PAYMENT_EMPTY_VALUE;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getPaymentTypeLabel(payment: Payment): string {
  return PAYMENT_TYPE_LABELS[payment.type] ?? payment.type;
}

export function getPaymentStatusLabel(payment: Payment): string {
  return PAYMENT_STATUS_LABELS[payment.status] ?? payment.statusText ?? payment.status;
}

export function getPaymentMethodLabel(payment: Payment): string {
  const method = payment.paymentMethod?.trim();
  return method ? (PAYMENT_METHOD_LABELS[method] ?? method) : PAYMENT_EMPTY_VALUE;
}

export function getPaymentRelationSummary(payment: Payment): PaymentRelationSummary {
  if (payment.assessmentId) {
    return {
      kind: 'assessment',
      id: payment.assessmentId,
      csvValue: payment.assessmentId,
      shortLabel: shortenPaymentId(payment.assessmentId),
      filterValue: payment.assessmentId,
    };
  }

  if (payment.subscriptionId) {
    return {
      kind: 'subscription',
      id: payment.subscriptionId,
      csvValue: payment.subscriptionId,
      shortLabel: shortenPaymentId(payment.subscriptionId),
      filterValue: payment.subscriptionId,
    };
  }

  return {
    kind: 'none',
    id: null,
    csvValue: PAYMENT_EMPTY_VALUE,
    shortLabel: PAYMENT_EMPTY_VALUE,
    filterValue: PAYMENT_EMPTY_VALUE,
  };
}

export function getPaymentReceiptSummary(payment: Payment): PaymentReceiptSummary {
  const fileName = payment.attachmentFileName?.trim() || '';
  const fileUrl = payment.attachmentFileUrl?.trim() || '';

  if (fileName && fileUrl) {
    return {
      state: 'available',
      fileName,
      canOpen: true,
      canDownload: true,
      csvValue: fileName,
    };
  }

  if (fileName && !fileUrl) {
    return {
      state: 'missing-url',
      fileName,
      canOpen: false,
      canDownload: false,
      csvValue: fileName,
    };
  }

  if (!fileName && fileUrl) {
    return {
      state: 'missing-file',
      fileName: PAYMENT_EMPTY_VALUE,
      canOpen: false,
      canDownload: false,
      csvValue: fileUrl,
    };
  }

  return {
    state: 'missing',
    fileName: PAYMENT_EMPTY_VALUE,
    canOpen: false,
    canDownload: false,
    csvValue: PAYMENT_EMPTY_VALUE,
  };
}

export function buildPaymentSearchSnapshot(
  payment: Payment,
  payerName = payment.payer,
): PaymentSearchSnapshot {
  return {
    id: String(payment.id),
    payer: payerName || payment.payer || PAYMENT_EMPTY_VALUE,
    type: getPaymentTypeLabel(payment),
    status: getPaymentStatusLabel(payment),
    method: getPaymentMethodLabel(payment),
    transactionId: payment.transactionId || PAYMENT_EMPTY_VALUE,
    relation: getPaymentRelationSummary(payment).filterValue,
    receipt: getPaymentReceiptSummary(payment).csvValue,
  };
}

export function getPaymentSearchTokens(payment: Payment, payerName = payment.payer): string[] {
  const snapshot = buildPaymentSearchSnapshot(payment, payerName);
  return Object.values(snapshot)
    .flatMap((value) => splitPaymentSearchValue(value))
    .filter(Boolean);
}

export function paymentMatchesSearch(
  payment: Payment,
  query: string,
  payerName = payment.payer,
): boolean {
  const normalizedQuery = normalizePaymentSearchValue(query);
  if (!normalizedQuery) {
    return true;
  }

  return getPaymentSearchTokens(payment, payerName).some((token) =>
    token.includes(normalizedQuery),
  );
}

export function getPaymentRiskTone(payment: Payment): PaymentRiskTone {
  if (payment.status === 'completed') {
    return 'success';
  }

  if (payment.status === 'failed' || payment.status === 'refunded') {
    return 'danger';
  }

  if (payment.status === 'pending') {
    return payment.transactionId ? 'warning' : 'neutral';
  }

  return 'neutral';
}

export function buildPaymentRowAriaLabel(payment: Payment, payerName = payment.payer): string {
  const relation = getPaymentRelationSummary(payment);
  const receipt = getPaymentReceiptSummary(payment);
  return [
    `payment ${payment.id}`,
    payerName || payment.payer,
    getPaymentTypeLabel(payment),
    formatPaymentMoney(payment.amount, payment.currency),
    getPaymentStatusLabel(payment),
    relation.id ? `${relation.kind} ${relation.shortLabel}` : 'without relation',
    receipt.canOpen ? `receipt ${receipt.fileName}` : 'without receipt',
  ]
    .filter(Boolean)
    .join(', ');
}

export function buildPaymentExportSummary(payments: Payment[]): string {
  const totals = payments.reduce(
    (acc, payment) => {
      acc.rows += 1;
      acc.amount += Number(payment.amount) || 0;
      acc.fee += Number(payment.fee) || 0;
      acc[payment.status] += 1;
      return acc;
    },
    {
      rows: 0,
      amount: 0,
      fee: 0,
      completed: 0,
      pending: 0,
      failed: 0,
      refunded: 0,
    },
  );

  return [
    `rows=${totals.rows}`,
    `amount=${formatPaymentMoney(totals.amount)}`,
    `fee=${formatPaymentFee(totals.fee)}`,
    `completed=${totals.completed}`,
    `pending=${totals.pending}`,
    `failed=${totals.failed}`,
    `refunded=${totals.refunded}`,
  ].join('; ');
}

export function shortenPaymentId(id: string | null | undefined, edgeLength = 8): string {
  if (!id) {
    return PAYMENT_EMPTY_VALUE;
  }

  if (id.length <= edgeLength * 2 + 3) {
    return id;
  }

  return `${id.slice(0, edgeLength)}...${id.slice(-edgeLength)}`;
}

function getPaymentNumberFormatter(locale: string): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function splitPaymentSearchValue(value: string): string[] {
  const normalized = normalizePaymentSearchValue(value);
  return normalized.split(/\s+/).filter(Boolean);
}

function normalizePaymentSearchValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
