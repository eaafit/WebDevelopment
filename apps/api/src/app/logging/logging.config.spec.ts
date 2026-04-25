import type { IncomingMessage, ServerResponse } from 'node:http';
import pino from 'pino';
import { PinoLogger, __resetOutOfContextForTests } from 'nestjs-pino/PinoLogger';
import {
  REDACTED_LOG_PATHS,
  bindRequestLoggingContext,
  createNestLoggerParams,
  createPinoHttpOptions,
  createPinoLoggerOptions,
  resolveLogLevel,
  sanitizeRequestPath,
} from './logging.config';

describe('logging config', () => {
  it('uses a valid LOG_LEVEL', () => {
    expect(resolveLogLevel({ LOG_LEVEL: 'warn', NODE_ENV: 'development' })).toBe('warn');
  });

  it('falls back for an invalid LOG_LEVEL', () => {
    expect(resolveLogLevel({ LOG_LEVEL: 'verbose', NODE_ENV: 'development' })).toBe('debug');
  });

  it('defaults production to info when LOG_LEVEL is unset', () => {
    expect(resolveLogLevel({ NODE_ENV: 'production' })).toBe('info');
  });

  it('logs paths without query strings', () => {
    expect(sanitizeRequestPath('/health?token=super-secret&signature=abc')).toBe('/health');
    expect(
      sanitizeRequestPath('https://api.example.test/api/payments/webhook?secret=super-secret'),
    ).toBe('/api/payments/webhook');
  });

  it('configures redaction for sensitive headers', () => {
    expect(REDACTED_LOG_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["set-cookie"]',
        'req.headers["x-payment-webhook-secret"]',
        'req.headers["x-yookassa-signature"]',
      ]),
    );
  });

  it('does not configure received request logs', () => {
    const options = createPinoHttpOptions({ NODE_ENV: 'test' });

    expect(options.customReceivedMessage).toBeUndefined();
    expect(options.customReceivedObject).toBeUndefined();
  });

  it('serializes request objects without headers or query strings', () => {
    const options = createPinoHttpOptions({ NODE_ENV: 'test' });
    const req = {
      id: 'request-id',
      method: 'GET',
      url: '/health?token=super-secret&signature=abc',
      headers: {
        authorization: 'Bearer secret',
      },
    };

    expect(options.serializers?.['req']?.(req)).toEqual({
      id: 'request-id',
      method: 'GET',
      path: '/health',
    });
  });

  it('configures a single manual access logger and uses existing request log for Nest context', () => {
    const options = createPinoHttpOptions({ NODE_ENV: 'test' });
    const nestParams = createNestLoggerParams();

    expect(options.quietReqLogger).toBe(true);
    expect(options.quietResLogger).toBe(true);
    expect(options.customAttributeKeys?.reqId).toBe('requestId');
    expect(nestParams.useExisting).toBe(true);
    expect((nestParams.pinoHttp as ReturnType<typeof createPinoHttpOptions>).autoLogging).toBe(
      false,
    );
  });

  it('keeps access log objects body-free and query-free', () => {
    const options = createPinoHttpOptions({ NODE_ENV: 'test' });
    const req = {
      method: 'GET',
      url: '/health?token=super-secret&signature=abc',
    } as IncomingMessage;
    const res = {
      statusCode: 200,
    } as ServerResponse;

    expect(options.customSuccessObject?.(req, res, { durationMs: 12 })).toEqual({
      method: 'GET',
      path: '/health',
      statusCode: 200,
      durationMs: 12,
    });
  });

  it('binds request logger storage so service logs inherit requestId', () => {
    __resetOutOfContextForTests();
    const requestLogger = pino({ base: null, timestamp: false }).child({
      requestId: 'unit-request-id',
    });
    const req = { log: requestLogger } as IncomingMessage & { log: typeof requestLogger };
    const res = {} as ServerResponse;

    bindRequestLoggingContext(req, res, () => {
      const pinoLogger = new PinoLogger({
        pinoHttp: createPinoHttpOptions({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
      });

      expect(pinoLogger.logger.bindings()).toEqual(
        expect.objectContaining({ requestId: 'unit-request-id' }),
      );
    });
    __resetOutOfContextForTests();
  });

  it('includes service, env, ISO time, and string log level settings', () => {
    const options = createPinoLoggerOptions({ NODE_ENV: 'test', LOG_LEVEL: 'error' });

    expect(options.level).toBe('error');
    expect(options.base).toEqual({ service: 'api', env: 'test' });
    expect(options.timestamp).toBeDefined();
    expect(options.formatters?.level?.('info', 30)).toEqual({ level: 'info' });
  });
});
