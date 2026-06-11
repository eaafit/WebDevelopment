import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BitrixOrderService {
  async publishOrder(orderId: string): Promise<void> {
    // Временная заглушка
    console.log('[Bitrix] Отправка заказа:', orderId);
    return Promise.resolve();
  }
}