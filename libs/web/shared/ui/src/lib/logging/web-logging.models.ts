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
  timestamp: string;
  context?: unknown;
}

export interface WebLoggingOptions {
  env?: string;
  production?: boolean;
}

export interface ResolvedWebLoggingOptions {
  env: string;
  production: boolean;
}

export function resolveWebLoggingOptions(
  options: WebLoggingOptions = {},
): ResolvedWebLoggingOptions {
  const production = options.production ?? !isDevMode();
  return {
    env: options.env ?? (production ? 'production' : 'development'),
    production,
  };
}
