import { InjectionToken, isDevMode } from '@angular/core';

export const WEB_SERVICE_NAME = 'web';
export const WEB_LOGGING_OPTIONS = new InjectionToken<ResolvedWebLoggingOptions>(
  'WEB_LOGGING_OPTIONS',
);
export const MASKED_LOG_VALUE = '[REDACTED]';

export type WebLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface WebLogEntry {
  service: typeof WEB_SERVICE_NAME;
  env: string;
  level: WebLogLevel;
  message: string;
  requestId: string;
  timestamp: string;
  context?: unknown;
}

export interface WebLoggingOptions {
  env?: string;
  production?: boolean;
  remoteEndpoint?: string | null;
}

export interface ResolvedWebLoggingOptions {
  env: string;
  production: boolean;
  remoteEndpoint: string | null;
}

export function resolveWebLoggingOptions(
  options: WebLoggingOptions = {},
): ResolvedWebLoggingOptions {
  const production = options.production ?? !isDevMode();
  return {
    env: options.env ?? (production ? 'production' : 'development'),
    production,
    remoteEndpoint: options.remoteEndpoint ?? resolveDefaultWebLogEndpoint(),
  };
}

export function resolveDefaultWebLogEndpoint(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000/api/logs/web';
  }

  const { hostname, origin, port } = window.location;
  const isLocal = ['localhost', '127.0.0.1'].includes(hostname);
  const apiOrigin = isLocal && port !== '3000' ? `http://${hostname}:3000` : origin;
  return `${apiOrigin}/api/logs/web`;
}
