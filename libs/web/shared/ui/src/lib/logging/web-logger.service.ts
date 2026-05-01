import { Injectable, inject } from '@angular/core';
import {
  MASKED_LOG_VALUE,
  WEB_LOGGING_OPTIONS,
  WEB_SERVICE_NAME,
  resolveWebLoggingOptions,
  type WebLogEntry,
  type WebLogLevel,
} from './web-logging.models';

const MAX_CONTEXT_DEPTH = 3;
const MAX_ARRAY_ITEMS = 10;

const SENSITIVE_KEYS = new Set(
  [
    'password',
    'token',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'authorization',
    'cookie',
    'setCookie',
    'set-cookie',
    'secret',
    'signature',
    'payment',
    'card',
    'passport',
    'user',
    'profile',
  ].map(normalizeKey),
);

interface SanitizeOptions {
  includeStack: boolean;
  depth?: number;
  seen?: WeakSet<object>;
}

@Injectable({ providedIn: 'root' })
export class WebLoggerService {
  private readonly options =
    inject(WEB_LOGGING_OPTIONS, { optional: true }) ?? resolveWebLoggingOptions();

  debug(message: string, context?: unknown): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: unknown): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: unknown): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: unknown): void {
    this.write('error', message, context);
  }

  private write(level: WebLogLevel, message: string, context?: unknown): void {
    if (!this.shouldWrite(level)) {
      return;
    }

    const entry: WebLogEntry = {
      service: WEB_SERVICE_NAME,
      env: this.options.env,
      level,
      message: sanitizeLogString(message),
      timestamp: new Date().toISOString(),
    };

    if (context !== undefined) {
      entry.context = sanitizeLogValue(context, {
        includeStack: !this.options.production,
      });
    }

    console[level](entry);
  }

  private shouldWrite(level: WebLogLevel): boolean {
    return !this.options.production || level === 'warn' || level === 'error';
  }
}

export function sanitizeLogValue(value: unknown, options: SanitizeOptions): unknown {
  const depth = options.depth ?? 0;
  const seen = options.seen ?? new WeakSet<object>();

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeLogString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'symbol' || typeof value === 'function') {
    return `[${typeof value}]`;
  }

  if (value instanceof Error) {
    return serializeErrorForLog(value, options);
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (depth >= MAX_CONTEXT_DEPTH) {
    return '[Object]';
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeLogValue(item, { ...options, depth: depth + 1, seen }));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    sanitized[key] = isSensitiveKey(key)
      ? MASKED_LOG_VALUE
      : sanitizeLogValue(nestedValue, { ...options, depth: depth + 1, seen });
  }

  return sanitized;
}

export function serializeErrorForLog(
  error: Error,
  options: SanitizeOptions,
): Record<string, unknown> {
  const details: Record<string, unknown> = {
    name: sanitizeLogString(error.name || 'Error'),
    message: sanitizeLogString(error.message),
  };

  if (options.includeStack && error.stack) {
    details['stack'] = sanitizeLogString(error.stack);
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    details['cause'] = sanitizeLogValue(cause, {
      ...options,
      depth: (options.depth ?? 0) + 1,
    });
  }

  return details;
}

export function sanitizeLogString(value: string): string {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, `$1${MASKED_LOG_VALUE}`)
    .replace(
      /([?&](?:token|access_token|refresh_token|secret|signature|password|code)=)[^&\s]+/gi,
      `$1${MASKED_LOG_VALUE}`,
    )
    .replace(
      /(^|[\s,{;])(password|token|accessToken|access_token|refreshToken|refresh_token|authorization|cookie|setCookie|set-cookie|secret|signature|card|passport)\s*[:=]\s*[^&,\s;}]+/gi,
      (_match, prefix: string, key: string) => `${prefix}${key}=${MASKED_LOG_VALUE}`,
    );
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(normalizeKey(key));
}

function normalizeKey(key: string): string {
  return key.replace(/[-_]/g, '').toLowerCase();
}
