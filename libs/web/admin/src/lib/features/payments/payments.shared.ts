export type PaymentType = 'Subscription' | 'Assessment' | 'DocumentCopy';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'card' | 'cash' | 'invoice';

export interface Payment {
  id: number;
  paymentDate: string;
  payer: string;
  amount: number;
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
}

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  Subscription: 'Подписка',
  Assessment: 'Оценка',
  DocumentCopy: 'Копия документа',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Банковская карта',
  cash: 'Наличные',
  invoice: 'Счет',
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

export const MOCK_PAYMENTS: Payment[] = [
  {
    id: 1001,
    paymentDate: '2025-03-02',
    payer: 'ООО "Ромашка"',
    amount: 12500.0,
    fee: 125.0,
    status: 'completed',
    statusText: 'Завершен',
    type: 'Assessment',
    assessmentId: 'a1b2c3d4-5001',
    paymentMethod: 'card',
    transactionId: 'txn_abc123',
    attachmentFileName: 'check_1001.pdf',
    attachmentFileUrl: '/receipts/check_1001.pdf',
  },
  {
    id: 1002,
    paymentDate: '2025-03-05',
    payer: 'ИП Иванов А.А.',
    amount: 5400.5,
    fee: 54.01,
    status: 'pending',
    statusText: 'В обработке',
    type: 'Subscription',
    subscriptionId: 'sub_xyz789',
    paymentMethod: 'invoice',
  },
  {
    id: 1003,
    paymentDate: '2025-03-13',
    payer: 'Петров В.К.',
    amount: 3200.0,
    fee: 32.0,
    status: 'failed',
    statusText: 'Ошибка',
    type: 'Assessment',
    paymentMethod: 'card',
  },
  {
    id: 1004,
    paymentDate: '2025-03-12',
    payer: 'ООО "ТехноСервис"',
    amount: 8700.75,
    fee: 87.01,
    status: 'completed',
    statusText: 'Завершен',
    type: 'DocumentCopy',
    assessmentId: 'e5f6g7h8-5003',
    paymentMethod: 'cash',
    transactionId: 'txn_def456',
  },
  {
    id: 1005,
    paymentDate: '2025-03-11',
    payer: 'Сидорова Е.М.',
    amount: 2100.0,
    fee: 21.0,
    status: 'pending',
    statusText: 'В обработке',
    type: 'Assessment',
    paymentMethod: 'card',
  },
  {
    id: 1006,
    paymentDate: '2025-03-10',
    payer: 'Былой Е.М.',
    amount: 21000.0,
    fee: 210.0,
    status: 'completed',
    statusText: 'Завершен',
    type: 'Subscription',
    subscriptionId: 'sub_abc111',
    paymentMethod: 'card',
    transactionId: 'txn_ghi789',
  },
  {
    id: 1007,
    paymentDate: '2025-03-09',
    payer: 'Елесей Е.М.',
    amount: 2500.0,
    fee: 25.0,
    status: 'refunded',
    statusText: 'Возврат',
    type: 'Assessment',
    paymentMethod: 'card',
    transactionId: 'txn_jkl012',
  },
];
