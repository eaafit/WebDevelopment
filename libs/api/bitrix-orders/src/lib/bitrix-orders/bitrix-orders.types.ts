// Поля заказа согласно Bitrix REST sale.order.add
// https://apidocs.bitrix24.ru/api-reference/sale/orders/sale-order-add.html
export interface OrderFields {
  LID?: string;                      // сайт (s1)
  PERSON_TYPE_ID?: number;           // тип плательщика
  USER_ID?: number;                  // ID пользователя в Bitrix
  BASKET?: BasketItem[];             // корзина (товары)
  PRICE?: number;                    // итоговая сумма
  CURRENCY?: string;                 // валюта
  STATUS_ID?: string;                // статус заказа (например, 'N' - новый)
  COMMENTS?: string;                 // комментарии
}

export interface BasketItem {
  PRODUCT_ID?: number;               // ID товара (опционально)
  NAME: string;                      // название
  QUANTITY: number;                  // количество
  PRICE: number;                     // цена за единицу
  CURRENCY?: string;                 // валюта
}

export interface BitrixSuccessResponse<T> {
  result: T;
  time?: {
    start: number;
    finish: number;
    duration: number;
    processing: number;
  };
}

export interface BitrixErrorResponse {
  error: string;
  error_description?: string;
}

export type BitrixResponse<T> = BitrixSuccessResponse<T> | BitrixErrorResponse;

export type OrderCreateResult = number;