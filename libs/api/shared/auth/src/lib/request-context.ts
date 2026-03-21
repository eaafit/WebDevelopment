import { AsyncLocalStorage } from 'async_hooks';
import type { AccessTokenPayload } from './auth.types';

export interface RequestContext {
  user: AccessTokenPayload | null;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  const ctx = requestContextStorage.getStore();
  if (!ctx) throw new Error('RequestContext is not available outside of a request');
  return ctx;
}

export function getCurrentUser(): AccessTokenPayload | null {
  return requestContextStorage.getStore()?.user ?? null;
}
