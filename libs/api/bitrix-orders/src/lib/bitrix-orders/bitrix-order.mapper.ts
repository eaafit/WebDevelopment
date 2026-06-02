import type { OrderFields, BasketItem } from './bitrix-orders.types';

// Типы, которые нужны мапперу (структурно совместимы с Prisma-сущностями)
export interface LeadLike {
  id: string;
  totalAmount?: number | string | null;   // берётся из assessment.estimatedValue
  assessment: {
    id: string;
    address: string;
    description?: string | null;
  };
  applicant: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber?: string | null;
  };
}

/**
 * Преобразует Lead в поля заказа Bitrix (sale.order.add).
 * Создаёт корзину с одним товаром "Оценка недвижимости".
 * Сумма берётся из totalAmount заказа (если есть).
 */
export function buildOrderFields(lead: LeadLike): OrderFields {
  const shortId = lead.id.substring(0, 8);
  const amount = parseAmount(lead.totalAmount);

  // Корзина: один товар
  const basket: BasketItem[] = [
    {
      NAME: `Оценка недвижимости (заказ ${shortId})`,
      QUANTITY: 1,
      PRICE: amount,
      CURRENCY: 'RUB',
    },
  ];

  const fields: OrderFields = {
    LID: 's1',
    PERSON_TYPE_ID: 1,
    BASKET: basket,
    CURRENCY: 'RUB',
    STATUS_ID: 'N', // новый заказ
    COMMENTS: `${lead.assessment.address || ''}\n${lead.assessment.description || ''}`.trim() || undefined,
  };

  // Если есть сумма, добавляем PRICE
  if (amount > 0) {
    fields.PRICE = amount;
  }

  // Можно добавить USER_ID, если в Bitrix есть синхронизация пользователей
  // но пока оставляем без привязки.
  console.log('[Mapper] Built order fields:', JSON.stringify(fields, null, 2));
  return fields;
}

function parseAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}