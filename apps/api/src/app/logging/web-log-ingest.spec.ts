import {
  buildWebLogObject,
  normalizeWebLogPayload,
  registerWebLogIngestion,
  WEB_LOG_INGEST_PATH,
} from './web-log-ingest';

describe('web log ingestion', () => {
  it('normalizes and redacts browser log payloads', () => {
    expect(
      normalizeWebLogPayload({
        env: 'production',
        level: 'ERROR',
        message: 'Failed with token=secret',
        timestamp: '2026-05-16T07:00:00.000Z',
        requestId: 'web-request-id',
        context: {
          safe: 'value',
          authorization: 'Bearer secret',
          nested: {
            url: 'https://example.test/callback?access_token=secret&ok=1',
          },
        },
      }),
    ).toEqual({
      env: 'production',
      level: 'error',
      message: 'Failed with token=[REDACTED]',
      timestamp: '2026-05-16T07:00:00.000Z',
      requestId: 'web-request-id',
      context: {
        safe: 'value',
        authorization: '[REDACTED]',
        nested: {
          url: 'https://example.test/callback?access_token=[REDACTED]&ok=1',
        },
      },
    });
  });

  it('rejects payloads without a supported level and message', () => {
    expect(normalizeWebLogPayload({ level: 'verbose', message: 'hello' })).toBeNull();
    expect(normalizeWebLogPayload({ level: 'error' })).toBeNull();
    expect(normalizeWebLogPayload(null)).toBeNull();
  });

  it('builds a log object labelled as web service', () => {
    const logObject = buildWebLogObject(
      {
        env: 'test',
        level: 'warn',
        message: 'warn message',
        requestId: 'request-id',
        timestamp: '2026-05-16T07:00:00.000Z',
      },
      {
        header: (name: string) => (name === 'user-agent' ? 'Test Browser' : undefined),
      },
    );

    expect(logObject).toEqual(
      expect.objectContaining({
        event: 'web_log',
        service: 'web',
        env: 'test',
        requestId: 'request-id',
        browserTimestamp: '2026-05-16T07:00:00.000Z',
        userAgent: 'Test Browser',
      }),
    );
  });

  it('registers the expected ingest path', () => {
    const post = jest.fn();
    registerWebLogIngestion({ post } as never, {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    });

    expect(post).toHaveBeenCalledWith(
      WEB_LOG_INGEST_PATH,
      expect.any(Function),
      expect.any(Function),
    );
  });
});
