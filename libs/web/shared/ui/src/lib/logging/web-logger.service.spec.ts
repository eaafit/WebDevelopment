import { TestBed } from '@angular/core/testing';
import { MASKED_LOG_VALUE, WEB_LOGGING_OPTIONS } from './web-logging.models';
import { sanitizeLogValue } from './web-logger.service';
import { WebLoggerService } from './web-logger.service';

describe('WebLoggerService', () => {
  let debugSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
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
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'web',
        env: 'development',
        level: 'info',
        message: 'info message',
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

function createLogger(options: { env: string; production: boolean }): WebLoggerService {
  TestBed.configureTestingModule({
    providers: [
      WebLoggerService,
      {
        provide: WEB_LOGGING_OPTIONS,
        useValue: options,
      },
    ],
  });

  return TestBed.inject(WebLoggerService);
}
