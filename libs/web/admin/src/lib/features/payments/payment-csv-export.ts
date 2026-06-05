import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  type Payment,
} from './payments.shared';

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
    resolve: (payment) =>
      payment.paymentMethod ? (PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod) : '—',
  },
  {
    key: 'transactionId',
    title: 'ID транзакции',
    resolve: (payment) => payment.transactionId || '—',
  },
  {
    key: 'attachment',
    title: 'Чек',
    resolve: (payment) => payment.attachmentFileName || '—',
  },
  {
    key: 'application',
    title: 'Заявка/подписка',
    resolve: (payment) => payment.assessmentId || payment.subscriptionId || '—',
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
  const numberFormatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const header = PAYMENT_CSV_COLUMNS.map((column) => column.title);
  const rows = payments.map((payment) =>
    PAYMENT_CSV_COLUMNS.map((column) =>
      formatColumnValue(column, payment, locale, numberFormatter),
    ),
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
  numberFormatter: Intl.NumberFormat,
): string {
  switch (column.key) {
    case 'paymentDate':
      return formatCsvDate(payment.paymentDate, locale);
    case 'amount':
      return `${numberFormatter.format(payment.amount)} ${payment.currency || 'RUB'}`;
    case 'fee':
      return numberFormatter.format(payment.fee ?? 0);
    default:
      return column.resolve(payment);
  }
}

function formatCsvDate(value: string, locale: string): string {
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

function escapeCsvValue(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
