import type { Express, Request, Response } from 'express';
import express from 'express';
import pino, { type Logger as PinoLoggerInstance } from 'pino';
import { createPinoLoggerOptions } from './logging.config';

export const WEB_LOG_INGEST_PATH = '/api/logs/web';
export const WEB_LOG_SERVICE_NAME = 'web';

const WEB_LOG_BODY_LIMIT = '64kb';
const MAX_STRING_LENGTH = 1000;
const MAX_CONTEXT_DEPTH = 3;
const MAX_ARRAY_ITEMS = 20;

const VALID_WEB_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type WebLogLevel = (typeof VALID_WEB_LOG_LEVELS)[number];

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

export interface WebLogPayload {
  env: string;
  level: WebLogLevel;
  message: string;
  requestId?: string;
  timestamp?: string;
  context?: unknown;
}

type WebLogLogger = Pick<PinoLoggerInstance, WebLogLevel>;
type WebLogRequestHeaders = {
  header: (name: string) => string | string[] | undefined;
};

export function createWebLogLogger(): WebLogLogger {
  return pino({
    ...createPinoLoggerOptions(),
    base: null,
  });
}

export function registerWebLogIngestion(
  expressInstance: Express,
  logger: WebLogLogger = createWebLogLogger(),
): void {
  expressInstance.post(
    WEB_LOG_INGEST_PATH,
    express.json({ limit: WEB_LOG_BODY_LIMIT, type: 'application/json' }),
    (req: Request, res: Response) => {
      const payload = normalizeWebLogPayload(req.body);
      if (!payload) {
        res.status(400).json({ error: 'invalid web log payload' });
        return;
      }

      logger[payload.level](buildWebLogObject(payload, req), payload.message);
      res.status(204).end();
    },
  );
}

export function normalizeWebLogPayload(body: unknown): WebLogPayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const level = typeof body['level'] === 'string' ? body['level'].toLowerCase() : '';
  if (!isWebLogLevel(level)) {
    return null;
  }

  const message = asLogString(body['message'] ?? body['msg']);
  if (!message) {
    return null;
  }

  return {
    env: asLogString(body['env']) || 'unknown',
    level,
    message,
    requestId: asOptionalLogString(body['requestId']),
    timestamp: asOptionalTimestamp(body['timestamp'] ?? body['time']),
    context:
      body['context'] === undefined
        ? undefined
        : sanitizeWebLogValue(body['context'], { depth: 0, seen: new WeakSet<object>() }),
  };
}

export function buildWebLogObject(
  payload: WebLogPayload,
  req: WebLogRequestHeaders,
): Record<string, unknown> {
  return {
    event: 'web_log',
    service: WEB_LOG_SERVICE_NAME,
    env: payload.env,
    requestId: payload.requestId ?? asOptionalLogString(req.header('x-request-id')),
    browserTimestamp: payload.timestamp,
    userAgent: asOptionalLogString(req.header('user-agent')),
    context: payload.context,
  };
}

function sanitizeWebLogValue(
  value: unknown,
  options: { depth: number; seen: WeakSet<object> },
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeWebLogString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'symbol' || typeof value === 'function') {
    return `[${typeof value}]`;
  }

  if (!isRecord(value)) {
    return '[Object]';
  }

  if (options.seen.has(value)) {
    return '[Circular]';
  }
  options.seen.add(value);

  if (options.depth >= MAX_CONTEXT_DEPTH) {
    return '[Object]';
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) =>
        sanitizeWebLogValue(item, { depth: options.depth + 1, seen: options.seen }),
      );
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    sanitized[key] = isSensitiveKey(key)
      ? '[REDACTED]'
      : sanitizeWebLogValue(nestedValue, {
          depth: options.depth + 1,
          seen: options.seen,
        });
  }

  return sanitized;
}

function asLogString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return sanitizeWebLogString(value.trim()).slice(0, MAX_STRING_LENGTH);
}

function asOptionalLogString(value: unknown): string | undefined {
  const sanitized = asLogString(value);
  return sanitized || undefined;
}

function asOptionalTimestamp(value: unknown): string | undefined {
  const timestamp = asLogString(value);
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
    return undefined;
  }

  return timestamp;
}

function sanitizeWebLogString(value: string): string {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
    .replace(
      /([?&](?:token|access_token|refresh_token|secret|signature|password|code)=)[^&\s]+/gi,
      '$1[REDACTED]',
    )
    .replace(
      /(^|[\s,{;])(password|token|accessToken|access_token|refreshToken|refresh_token|authorization|cookie|setCookie|set-cookie|secret|signature|card|passport)\s*[:=]\s*[^&,\s;}]+/gi,
      (_match, prefix: string, key: string) => `${prefix}${key}=[REDACTED]`,
    );
}

function isWebLogLevel(value: string): value is WebLogLevel {
  return VALID_WEB_LOG_LEVELS.includes(value as WebLogLevel);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(normalizeKey(key));
}

function normalizeKey(key: string): string {
  return key.replace(/[-_]/g, '').toLowerCase();
}
