import { TestBed } from '@angular/core/testing';
import { MASKED_LOG_VALUE, WEB_LOGGING_OPTIONS } from './web-logging.models';
import { WebErrorHandler } from './web-error-handler';
import { sanitizeLogValue } from './web-logger.service';
import { WebLoggerService } from './web-logger.service';

describe('WebLoggerService', () => {
  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let fetchMock: jest.Mock;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
  });

  afterEach(() => {
    if (originalFetch) {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: originalFetch,
      });
    } else {
      delete (globalThis as Partial<typeof globalThis>).fetch;
    }

    TestBed.resetTestingModule();
    jest.restoreAllMocks();
  });

  it('writes debug and info logs in dev', () => {
    const logger = createLogger({ env: 'development', production: false });

    logger.debug('debug message', { feature: 'dashboard' });
    logger.info('info message');

    expect(debugSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'web',
        env: 'development',
        level: 'debug',
        message: 'debug message',
        requestId: expect.any(String),
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'web',
        env: 'development',
        level: 'info',
        message: 'info message',
        requestId: expect.any(String),
      }),
    );
  });

  it('does not write debug and info logs in prod', () => {
    const logger = createLogger({ env: 'production', production: true });

    logger.debug('debug message');
    logger.info('info message');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('writes warn and error logs in prod', () => {
    const logger = createLogger({ env: 'production', production: true });

    logger.warn('warn message');
    logger.error('error message');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'warn', message: 'warn message' }),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error', message: 'error message' }),
    );
  });

  it('ships production info logs to the remote endpoint without writing them to console', () => {
    const logger = createLogger({
      env: 'production',
      production: true,
      remoteEndpoint: 'http://localhost:3000/api/logs/web',
    });

    logger.info('audit export completed', { exportedRows: 3 });

    expect(infoSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/logs/web',
      expect.objectContaining({
        credentials: 'same-origin',
        keepalive: true,
        method: 'POST',
      }),
    );

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        'X-Request-Id': expect.any(String),
      }),
    );
    expect(JSON.parse(String(requestInit.body))).toEqual(
      expect.objectContaining({
        context: { exportedRows: 3 },
        env: 'production',
        level: 'info',
        message: 'audit export completed',
        requestId: expect.any(String),
        service: 'web',
      }),
    );
  });

  it('does not ship logs when the remote endpoint is disabled', () => {
    const logger = createLogger({ env: 'production', production: true, remoteEndpoint: null });

    logger.warn('warn message');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('masks sensitive keys and string secrets', () => {
    expect(
      sanitizeLogValue(
        {
          token: 'abc',
          accessToken: 'def',
          access_token: 'ghi',
          refresh_token: 'jkl',
          authorization: 'Bearer secret-token',
          'set-cookie': 'session=secret',
          'x-request-id': 'safe-request-id',
          nested: {
            signature: 'signed',
            safe: 'https://example.test/callback?token=super-secret&ok=1',
          },
          payment: { id: 'payment-id' },
        },
        { includeStack: false },
      ),
    ).toEqual({
      token: MASKED_LOG_VALUE,
      accessToken: MASKED_LOG_VALUE,
      access_token: MASKED_LOG_VALUE,
      refresh_token: MASKED_LOG_VALUE,
      authorization: MASKED_LOG_VALUE,
      'set-cookie': MASKED_LOG_VALUE,
      'x-request-id': 'safe-request-id',
      nested: {
        signature: MASKED_LOG_VALUE,
        safe: `https://example.test/callback?token=${MASKED_LOG_VALUE}&ok=1`,
      },
      payment: MASKED_LOG_VALUE,
    });
  });

  it('masks multiple sensitive query params and bearer tokens in strings', () => {
    expect(
      sanitizeLogValue(
        {
          message:
            'Bearer super-secret-token url=https://example.test/callback?access_token=a&refresh_token=b&signature=c&ok=1',
        },
        { includeStack: false },
      ),
    ).toEqual({
      message: `Bearer ${MASKED_LOG_VALUE} url=https://example.test/callback?access_token=${MASKED_LOG_VALUE}&refresh_token=${MASKED_LOG_VALUE}&signature=${MASKED_LOG_VALUE}&ok=1`,
    });
  });

  it('handles arrays and circular objects safely', () => {
    const circular: Record<string, unknown> = { safe: 'value' };
    circular['self'] = circular;

    expect(
      sanitizeLogValue(
        {
          items: [{ password: 'secret' }, circular],
        },
        { includeStack: false },
      ),
    ).toEqual({
      items: [{ password: MASKED_LOG_VALUE }, { safe: 'value', self: '[Circular]' }],
    });
  });

  it('serializes Error cause without leaking sensitive details', () => {
    const error = new Error('Failed with token=super-secret', {
      cause: {
        authorization: 'Bearer nested-secret',
      },
    });

    expect(sanitizeLogValue(error, { includeStack: false })).toEqual({
      name: 'Error',
      message: `Failed with token=${MASKED_LOG_VALUE}`,
      cause: {
        authorization: MASKED_LOG_VALUE,
      },
    });
  });
});

describe('WebErrorHandler', () => {
  it('sends unhandled errors to the logger', () => {
    const logger = { error: jest.fn() } as unknown as WebLoggerService;
    const handler = createErrorHandler(logger);
    const error = new Error('boom');

    handler.handleError(error);

    expect(logger.error).toHaveBeenCalledWith('Unhandled application error', { error });
  });

  it('does not throw for weird unknown error input', () => {
    const logger = { error: jest.fn() } as unknown as WebLoggerService;
    const handler = createErrorHandler(logger);

    expect(() => handler.handleError(Object.create(null))).not.toThrow();
  });

  it('does not throw if logging itself fails', () => {
    const logger = {
      error: jest.fn(() => {
        throw new Error('logger failed');
      }),
    } as unknown as WebLoggerService;
    const handler = createErrorHandler(logger);

    expect(() => handler.handleError(new Error('boom'))).not.toThrow();
  });
});

function createLogger(options: {
  env: string;
  production: boolean;
  remoteEndpoint?: string | null;
}): WebLoggerService {
  TestBed.configureTestingModule({
    providers: [
      WebLoggerService,
      {
        provide: WEB_LOGGING_OPTIONS,
        useValue: {
          remoteEndpoint: null,
          ...options,
        },
      },
    ],
  });

  return TestBed.inject(WebLoggerService);
}

function createErrorHandler(logger: WebLoggerService): WebErrorHandler {
  TestBed.configureTestingModule({
    providers: [
      WebErrorHandler,
      {
        provide: WebLoggerService,
        useValue: logger,
      },
    ],
  });

  return TestBed.inject(WebErrorHandler);
}
