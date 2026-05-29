import { Injectable, inject } from '@angular/core';
import { WebLoggerService } from '@notary-portal/ui';

/**
 * Клиентский структурный логгер админских UI-действий в зоне заявок
 * (Лаба №8, log).
 *
 * Переиспользует готовый `WebLoggerService` (`@notary-portal/ui`) — он
 * добавляет requestId/timestamp, санитизирует чувствительные поля и (по
 * конфигурации app.config) шлёт структурный лог в общий приёмник
 * `/api/logs/web`. Здесь только доменная обёртка: словарь админ-действий
 * (открытие карточки, смена фильтра/сортировки, экспорт) + локальный
 * кольцевой буфер последних записей для отладки/демонстрации.
 *
 * Бэкенда/RPC/персистенции в БД сам логгер НЕ добавляет.
 */
export type AdminOrderAction =
  | 'order_card_opened'
  | 'list_filter_changed'
  | 'list_sort_changed'
  | 'list_exported';

export interface AdminOrderActivityEntry {
  timestamp: string;
  actorRole: string;
  action: AdminOrderAction;
  payload: Record<string, unknown>;
}

const ACTOR_ROLE = 'Admin';
const LOG_PREFIX = 'admin_order';
const MAX_BUFFER = 50;

@Injectable({ providedIn: 'root' })
export class AdminOrderActivityLogger {
  private readonly logger = inject(WebLoggerService);
  private readonly buffer: AdminOrderActivityEntry[] = [];

  /** Открытие карточки заявки (`/admin/orders` → модалка). */
  logCardOpened(assessmentId: string, status: string): void {
    this.record('order_card_opened', { assessmentId, status });
  }

  /** Смена фильтра списка заявок (поиск, диапазон дат, нотариус, колонка, сброс). */
  logFilterChanged(payload: Record<string, unknown>): void {
    this.record('list_filter_changed', payload);
  }

  /** Смена сортировки списка заявок. */
  logSortChanged(column: string, direction: 'asc' | 'desc' | ''): void {
    this.record('list_sort_changed', { column, direction });
  }

  /** Экспорт списка заявок (CSV). */
  logExport(format: string, rowCount: number): void {
    this.record('list_exported', { format, rowCount });
  }

  /** Снимок последних записей буфера (для отладки/демонстрации). */
  getRecentEntries(): readonly AdminOrderActivityEntry[] {
    return [...this.buffer];
  }

  private record(action: AdminOrderAction, payload: Record<string, unknown>): void {
    const entry: AdminOrderActivityEntry = {
      timestamp: new Date().toISOString(),
      actorRole: ACTOR_ROLE,
      action,
      payload,
    };

    this.buffer.push(entry);
    if (this.buffer.length > MAX_BUFFER) {
      this.buffer.shift();
    }

    this.logger.info(`${LOG_PREFIX}.${action}`, {
      actorRole: ACTOR_ROLE,
      action,
      ...payload,
    });
  }
}
