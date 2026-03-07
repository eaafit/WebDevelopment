import { AsyncLocalStorage } from 'async_hooks';
import type { AccessTokenPayload } from './token.service';

// ─── Контекст текущего запроса ───────────────────────────────────────────────
// Хранится в AsyncLocalStorage — доступен из любого сервиса в цепочке вызова
// без передачи явных параметров.

export interface RequestContext {
  user: AccessTokenPayload | null; // null = анонимный запрос
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

// ─── Хелперы ────────────────────────────────────────────────────────────────

/** Возвращает текущий контекст. Бросает если вызывается вне запроса. */
export function getRequestContext(): RequestContext {
  const ctx = requestContextStorage.getStore();
  if (!ctx) throw new Error('RequestContext is not available outside of a request');
  return ctx;
}

/** Возвращает текущего пользователя или null. */
export function getCurrentUser(): AccessTokenPayload | null {
  return requestContextStorage.getStore()?.user ?? null;
}
