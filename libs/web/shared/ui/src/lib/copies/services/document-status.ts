import { DocumentStatus } from '@notary-portal/api-contracts';

// Единый источник правды для отображения статуса заказа копии.
// Статус берётся из собственного поля Document.status (DocumentStatus), а не из
// статуса заявки — это устраняет баг «CANCELLED → Выдано».

export type CopyStatusKey =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export interface CopyStatusView {
  key: CopyStatusKey;
  label: string;
  canDownload: boolean;
}

const STATUS_MAP: Record<number, CopyStatusView> = {
  [DocumentStatus.PENDING_PAYMENT]: { key: 'pending', label: 'Ожидает оплаты', canDownload: false },
  [DocumentStatus.PAID]: { key: 'paid', label: 'Оплачено', canDownload: false },
  [DocumentStatus.IN_PROGRESS]: { key: 'processing', label: 'В обработке', canDownload: false },
  [DocumentStatus.READY]: { key: 'ready', label: 'Готово', canDownload: true },
  [DocumentStatus.DELIVERED]: { key: 'delivered', label: 'Выдано', canDownload: true },
  [DocumentStatus.CANCELLED]: { key: 'cancelled', label: 'Отменено', canDownload: false },
};

const DEFAULT_VIEW: CopyStatusView = { key: 'pending', label: 'Ожидает оплаты', canDownload: false };

export function mapCopyStatus(status: number | undefined): CopyStatusView {
  if (status === undefined) return DEFAULT_VIEW;
  return STATUS_MAP[status] ?? DEFAULT_VIEW;
}

// Фолбэк стоимости копии, если у заказа не задан price (напр. старые/сид-данные
// без цены). Гарантирует положительную сумму к оплате (createPayment требует > 0).
export const DEFAULT_COPY_PRICE = 300;

export function resolveCopyPrice(price: number | undefined): number {
  return price && price > 0 ? price : DEFAULT_COPY_PRICE;
}
