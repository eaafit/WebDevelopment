export type PaymentType = 'Subscription' | 'Assessment' | 'DocumentCopy';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = string;

export interface Payment {
  id: string | number;
  userId: string;
  paymentDate: string;
  payer: string;
  amount: number;
  currency: string;
  fee: number;
  status: PaymentStatus;
  statusText: string;
  type: PaymentType;
  subscriptionId?: string | null;
  assessmentId?: string | null;
  paymentMethod?: PaymentMethod;
  transactionId?: string;
  attachmentFileName?: string;
  attachmentFileUrl?: string;
  description?: string;
}

export const MOCK_PAYMENTS: Payment[] = [
  {
    id: 'payment-1',
    userId: 'user-1',
    paymentDate: '2026-03-06T08:45:00.000Z',
    payer: 'user-1',
    amount: 12500,
    currency: 'RUB',
    fee: 0,
    status: 'completed',
    statusText: 'Завершен',
    type: 'Assessment',
    assessmentId: 'assessment-1',
    paymentMethod: 'bank_card',
    transactionId: 'txn_abc123',
    attachmentFileName: 'check_1001.pdf',
    attachmentFileUrl: '/receipts/check_1001.pdf',
  },
  {
    id: 'payment-2',
    userId: 'user-2',
    paymentDate: '2026-03-05T10:15:00.000Z',
    payer: 'user-2',
    amount: 5400.5,
    currency: 'RUB',
    fee: 0,
    status: 'pending',
    statusText: 'В обработке',
    type: 'Subscription',
    subscriptionId: 'sub_xyz789',
    paymentMethod: 'invoice',
  },
];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  Subscription: 'Подписка',
  Assessment: 'Оценка',
  DocumentCopy: 'Копия документа',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Банковская карта',
  bank_card: 'Банковская карта',
  cash: 'Наличные',
  invoice: 'Счет',
  sbp: 'СБП',
  bank_transfer: 'Банковский перевод',
  yookassa_widget: 'ЮKassa',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  completed: 'Завершен',
  pending: 'В обработке',
  failed: 'Ошибка',
  refunded: 'Возврат',
};

export const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ['card', 'cash', 'invoice'];
export const PAYMENT_TYPE_OPTIONS: PaymentType[] = ['Subscription', 'Assessment', 'DocumentCopy'];
export const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = [
  'completed',
  'pending',
  'failed',
  'refunded',
];
