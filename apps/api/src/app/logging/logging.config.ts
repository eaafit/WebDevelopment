import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import { Store as PinoLoggerStore, storage as pinoLoggerStorage } from 'nestjs-pino/storage';
import type { Logger as PinoLoggerInstance, LoggerOptions, LevelWithSilent } from 'pino';
import pino from 'pino';
import pinoHttp, { type Options as PinoHttpOptions, type HttpLogger } from 'pino-http';
import {
  RESPONSE_REQUEST_ID_HEADER,
  resolveRequestIdFromHeaders,
  type RequestHeaders,
} from './request-id';

export const API_SERVICE_NAME = 'api';

export const VALID_LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
] as const satisfies readonly LevelWithSilent[];

export type ApiLogLevel = (typeof VALID_LOG_LEVELS)[number];

export const REDACTED_LOG_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-payment-webhook-secret"]',
  'req.headers["x-yookassa-signature"]',
  'headers.authorization',
  'headers.cookie',
  'headers["set-cookie"]',
  'headers["x-payment-webhook-secret"]',
  'headers["x-yookassa-signature"]',
  'authorization',
  'cookie',
  'set-cookie',
  'x-payment-webhook-secret',
  'x-yookassa-signature',
] as const;

interface RuntimeEnv {
  [key: string]: string | undefined;
  LOG_LEVEL?: string;
  NODE_ENV?: string;
}

type LoggedIncomingMessage = IncomingMessage & {
  id?: unknown;
  log?: PinoLoggerInstance;
};

type LoggedServerResponse = ServerResponse & {
  log?: PinoLoggerInstance;
};

export function resolveLogLevel(env: RuntimeEnv = process.env): ApiLogLevel {
  const configuredLevel = env.LOG_LEVEL?.trim().toLowerCase();
  if (isApiLogLevel(configuredLevel)) {
    return configuredLevel;
  }

  return env.NODE_ENV === 'production' ? 'info' : 'debug';
}

export function resolveRuntimeEnv(env: RuntimeEnv = process.env): string {
  return env.NODE_ENV?.trim() || 'development';
}

export function sanitizeRequestPath(url: string | undefined): string {
  if (!url) {
    return '/';
  }

  try {
    return new URL(url, 'http://localhost').pathname || '/';
  } catch {
    return url.split('?')[0] || '/';
  }
}

export function createPinoLoggerOptions(env: RuntimeEnv = process.env): LoggerOptions {
  return {
    level: resolveLogLevel(env),
    base: {
      service: API_SERVICE_NAME,
      env: resolveRuntimeEnv(env),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: [...REDACTED_LOG_PATHS],
      censor: '[REDACTED]',
    },
  };
}

export function createPinoHttpOptions(
  env: RuntimeEnv = process.env,
  autoLogging: PinoHttpOptions['autoLogging'] = true,
): PinoHttpOptions<IncomingMessage, ServerResponse> {
  const loggerOptions = createPinoLoggerOptions(env);

  return {
    ...loggerOptions,
    autoLogging,
    genReqId: (req, res) => {
      const requestId = resolveRequestIdFromHeaders(req.headers as RequestHeaders);
      res.setHeader(RESPONSE_REQUEST_ID_HEADER, requestId);
      return requestId;
    },
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) {
        return 'error';
      }

      if (res.statusCode >= 400) {
        return 'warn';
      }

      return 'info';
    },
    customAttributeKeys: {
      reqId: 'requestId',
      responseTime: 'durationMs',
    },
    customSuccessMessage: () => 'request completed',
    customErrorMessage: () => 'request failed',
    quietReqLogger: true,
    quietResLogger: true,
    wrapSerializers: false,
    serializers: {
      req: (req: IncomingMessage & { id?: unknown }) => ({
        id: String(req.id ?? ''),
        method: req.method,
        path: sanitizeRequestPath(req.url),
      }),
      res: (res: ServerResponse) => ({
        statusCode: res.statusCode,
      }),
    },
    customSuccessObject: (req, res, value) => buildRequestLogObject(req, res, value),
    customErrorObject: (req, res, error, value) => ({
      ...buildRequestLogObject(req, res, value),
      err: error,
    }),
  };
}

export function createHttpLoggingMiddleware(): HttpLogger<IncomingMessage, ServerResponse> {
  const httpLogger = pinoHttp(createPinoHttpOptions());
  const middleware = ((req: IncomingMessage, res: ServerResponse, next?: () => void) => {
    httpLogger(req, res, () => {
      bindRequestLoggingContext(req as LoggedIncomingMessage, res as LoggedServerResponse, next);
    });
  }) as HttpLogger<IncomingMessage, ServerResponse>;

  middleware.logger = httpLogger.logger;
  return middleware;
}

export function bindRequestLoggingContext(
  req: LoggedIncomingMessage,
  res: LoggedServerResponse,
  next?: () => void,
): void {
  if (!req.log) {
    next?.();
    return;
  }

  pinoLoggerStorage.run(new PinoLoggerStore(req.log, res.log), () => {
    next?.();
  });
}

export function createNestLoggerParams(): Params {
  return {
    pinoHttp: createPinoHttpOptions(process.env, false),
    useExisting: true,
  };
}

function buildRequestLogObject(
  req: IncomingMessage,
  res: ServerResponse,
  value: { durationMs?: number; responseTime?: number },
): Record<string, unknown> {
  return {
    method: req.method,
    path: sanitizeRequestPath(req.url),
    statusCode: res.statusCode,
    durationMs: value.durationMs ?? value.responseTime,
  };
}

function isApiLogLevel(value: string | undefined): value is ApiLogLevel {
  return VALID_LOG_LEVELS.includes(value as ApiLogLevel);
}
