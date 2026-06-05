import { PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS, type Payment } from './payments.shared';
import {
  formatPaymentDateTime,
  formatPaymentFee,
  formatPaymentMoney,
  getPaymentMethodLabel,
  getPaymentReceiptSummary,
  getPaymentRelationSummary,
} from './payment-display';

export interface PaymentCsvColumn {
  key: string;
  title: string;
  resolve: (payment: Payment) => string;
}

export interface PaymentCsvBuildOptions {
  locale?: string;
  separator?: string;
  includeBom?: boolean;
  generatedAt?: Date;
}

const DEFAULT_LOCALE = 'ru-RU';
const DEFAULT_SEPARATOR = ';';

export const PAYMENT_CSV_COLUMNS: PaymentCsvColumn[] = [
  {
    key: 'id',
    title: 'ID',
    resolve: (payment) => String(payment.id),
  },
  {
    key: 'paymentDate',
    title: 'Дата платежа',
    resolve: (payment) => payment.paymentDate,
  },
  {
    key: 'payer',
    title: 'Плательщик',
    resolve: (payment) => payment.payer,
  },
  {
    key: 'type',
    title: 'Тип',
    resolve: (payment) => PAYMENT_TYPE_LABELS[payment.type],
  },
  {
    key: 'amount',
    title: 'Сумма',
    resolve: (payment) => String(payment.amount),
  },
  {
    key: 'fee',
    title: 'Комиссия',
    resolve: (payment) => String(payment.fee ?? 0),
  },
  {
    key: 'paymentMethod',
    title: 'Метод оплаты',
    resolve: (payment) => getPaymentMethodLabel(payment),
  },
  {
    key: 'transactionId',
    title: 'ID транзакции',
    resolve: (payment) => payment.transactionId || '\u2014',
  },
  {
    key: 'attachment',
    title: 'Чек',
    resolve: (payment) => getPaymentReceiptSummary(payment).csvValue,
  },
  {
    key: 'application',
    title: 'Заявка/подписка',
    resolve: (payment) => getPaymentRelationSummary(payment).csvValue,
  },
  {
    key: 'status',
    title: 'Статус',
    resolve: (payment) => PAYMENT_STATUS_LABELS[payment.status],
  },
];

export function buildPaymentCsvContent(
  payments: Payment[],
  options: PaymentCsvBuildOptions = {},
): string {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const separator = options.separator ?? DEFAULT_SEPARATOR;
  const header = PAYMENT_CSV_COLUMNS.map((column) => column.title);
  const rows = payments.map((payment) =>
    PAYMENT_CSV_COLUMNS.map((column) => formatColumnValue(column, payment, locale)),
  );

  const content = [header, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(separator))
    .join('\r\n');

  return options.includeBom === false ? content : `\uFEFF${content}`;
}

export function buildPaymentCsvFileName(now = new Date()): string {
  const stamp = now.toISOString().replaceAll(':', '-').slice(0, 19);
  return `payments-${stamp}.csv`;
}

function formatColumnValue(
  column: PaymentCsvColumn,
  payment: Payment,
  locale: string,
): string {
  switch (column.key) {
    case 'paymentDate':
      return formatPaymentDateTime(payment.paymentDate, locale);
    case 'amount':
      return formatPaymentMoney(payment.amount, payment.currency, locale);
    case 'fee':
      return formatPaymentFee(payment.fee, locale);
    default:
      return column.resolve(payment);
  }
}

function escapeCsvValue(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
