import { IncomingMessage, type IncomingHttpHeaders } from 'http';
import {
  applySafeIncomingHttpAttributes,
  buildNodeAutoInstrumentationConfig,
  resolveSafeHttpPath,
} from './tracing';

describe('OpenTelemetry HTTP span sanitization', () => {
  const originalHttpSpanHost = process.env['OTEL_HTTP_SPAN_HOST'];

  beforeEach(() => {
    delete process.env['OTEL_HTTP_SPAN_HOST'];
  });

  afterAll(() => {
    if (originalHttpSpanHost === undefined) {
      delete process.env['OTEL_HTTP_SPAN_HOST'];
      return;
    }

    process.env['OTEL_HTTP_SPAN_HOST'] = originalHttpSpanHost;
  });

  it('uses express route attributes instead of raw signed URLs', () => {
    const span = mockSpan();
    const request = buildRequest({
      url: '/api/documents/11111111-1111-4111-8111-111111111111/content?mode=download&signature=secret-signature',
      headers: { host: '127.0.0.1:3337' },
      routePath: '/api/documents/:documentId/content',
    });

    applySafeIncomingHttpAttributes(span, request);

    expect(span.setAttribute).toHaveBeenCalledWith(
      'http.target',
      '/api/documents/:documentId/content',
    );
    expect(span.setAttribute).toHaveBeenCalledWith(
      'http.url',
      'http://notary-api/api/documents/:documentId/content',
    );
    expect(span.setAttribute).toHaveBeenCalledWith('url.query', '[REDACTED]');

    const payload = JSON.stringify(span.setAttribute.mock.calls);
    expect(payload).not.toContain('11111111-1111-4111-8111-111111111111');
    expect(payload).not.toContain('secret-signature');
    expect(payload).not.toContain('signature=');
  });

  it('falls back to normalized dynamic path segments when express route is unavailable', () => {
    const request = buildRequest({
      url: '/api/documents/22222222-2222-4222-8222-222222222222/content?signature=secret-signature',
      headers: { host: 'localhost:3337' },
    });

    expect(resolveSafeHttpPath(request)).toBe('/api/documents/:id/content');
  });

  it('keeps incoming HTTP spans enabled and disables unsafe outgoing HTTP/AWS auto spans', () => {
    const config = buildNodeAutoInstrumentationConfig();
    const httpConfig = config['@opentelemetry/instrumentation-http'];

    expect(config['@opentelemetry/instrumentation-aws-sdk']).toEqual({ enabled: false });
    expect(httpConfig).toEqual(
      expect.objectContaining({
        disableOutgoingRequestInstrumentation: true,
      }),
    );
    expect(httpConfig).not.toEqual(
      expect.objectContaining({
        disableIncomingRequestInstrumentation: true,
      }),
    );
    expect(httpConfig?.applyCustomAttributesOnSpan).toEqual(expect.any(Function));
  });

  it('redacts query data from incoming HTTP auto spans', () => {
    const span = mockSpan();
    const request = buildRequest({
      url: '/oauth/bitrix/callback?access_token=bitrix-token&file=payment-documents/raw-key&signature=secret-signature',
      headers: { host: 'api.notary.test', 'x-forwarded-proto': 'https' },
    });
    const httpConfig = buildNodeAutoInstrumentationConfig()['@opentelemetry/instrumentation-http'];

    httpConfig?.applyCustomAttributesOnSpan?.(span as never, request, {} as never);

    expect(span.setAttribute).toHaveBeenCalledWith('url.query', '[REDACTED]');

    const payload = JSON.stringify(span.setAttribute.mock.calls);
    expect(payload).not.toContain('bitrix-token');
    expect(payload).not.toContain('payment-documents/raw-key');
    expect(payload).not.toContain('secret-signature');
    expect(payload).not.toContain('access_token=');
  });

  it('does not trust raw Host or unsafe x-forwarded-proto headers', () => {
    const span = mockSpan();
    const request = buildRequest({
      url: '/api/payments?token=secret-token',
      headers: {
        host: 'evil.example/@test@example.com?token=secret',
        'x-forwarded-proto': 'javascript:alert(1)',
      },
      routePath: '/api/payments',
    });

    applySafeIncomingHttpAttributes(span, request);

    expect(span.setAttribute).toHaveBeenCalledWith('http.target', '/api/payments');
    expect(span.setAttribute).toHaveBeenCalledWith('url.path', '/api/payments');
    expect(span.setAttribute).toHaveBeenCalledWith('url.query', '[REDACTED]');
    expect(span.setAttribute).toHaveBeenCalledWith('http.url', 'http://notary-api/api/payments');
    expect(span.setAttribute).toHaveBeenCalledWith('url.full', 'http://notary-api/api/payments');

    const payload = JSON.stringify(span.setAttribute.mock.calls);
    expect(payload).not.toContain('evil.example');
    expect(payload).not.toContain('javascript:alert');
    expect(payload).not.toContain('secret-token');
    expect(payload).not.toContain('token=');
  });
});

function mockSpan(): { setAttribute: jest.Mock } {
  return { setAttribute: jest.fn() };
}

function buildRequest(input: {
  url: string;
  headers: IncomingHttpHeaders;
  routePath?: string;
}): IncomingMessage {
  const request = {
    url: input.url,
    headers: input.headers,
    route: input.routePath ? { path: input.routePath } : undefined,
  } as unknown as IncomingMessage;
  Object.setPrototypeOf(request, IncomingMessage.prototype);
  return request;
}
