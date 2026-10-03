import { AsyncLocalStorage } from 'async_hooks';
import { createContextKey } from '@connectrpc/connect';
import type { AccessTokenPayload } from './auth.types';

export interface RequestMetadata {
  ip: string | null;
  userAgent: string | null;
}

export interface RequestContext {
  user: AccessTokenPayload | null;
  metadata: RequestMetadata;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();
export const REQUEST_IP_CONTEXT_KEY = createContextKey<string | null>(null, {
  description: 'Request IP address for audit trail',
});

export function getRequestContext(): RequestContext {
  const ctx = requestContextStorage.getStore();
  if (!ctx) throw new Error('RequestContext is not available outside of a request');
  return ctx;
}

export function getCurrentUser(): AccessTokenPayload | null {
  return requestContextStorage.getStore()?.user ?? null;
}

export function getRequestMetadata(): RequestMetadata {
  return requestContextStorage.getStore()?.metadata ?? { ip: null, userAgent: null };
}
