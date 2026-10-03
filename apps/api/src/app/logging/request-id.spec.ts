import {
  MAX_REQUEST_ID_LENGTH,
  extractTraceIdFromTraceparent,
  normalizeIncomingRequestId,
  resolveRequestIdFromHeaders,
} from './request-id';

describe('request id policy', () => {
  it('uses a valid X-Request-Id when present', () => {
    expect(
      resolveRequestIdFromHeaders(
        {
          'x-request-id': ' smoke-issue-32:api.v1_test ',
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00',
        },
        () => 'generated',
      ),
    ).toBe('smoke-issue-32:api.v1_test');
  });

  it('rejects too long X-Request-Id and uses traceparent', () => {
    expect(
      resolveRequestIdFromHeaders(
        {
          'x-request-id': 'a'.repeat(MAX_REQUEST_ID_LENGTH + 1),
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00',
        },
        () => 'generated',
      ),
    ).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });

  it('rejects X-Request-Id with newline or control characters', () => {
    expect(normalizeIncomingRequestId('bad\nid')).toBeNull();
    expect(normalizeIncomingRequestId('bad\u0000id')).toBeNull();
  });

  it('rejects X-Request-Id with whitespace inside', () => {
    expect(
      resolveRequestIdFromHeaders(
        {
          'x-request-id': 'bad id',
        },
        () => 'generated-id',
      ),
    ).toBe('generated-id');
  });

  it('extracts the trace id from traceparent when X-Request-Id is missing', () => {
    expect(
      resolveRequestIdFromHeaders(
        {
          traceparent: '00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-00',
        },
        () => 'generated',
      ),
    ).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });

  it('keeps valid X-Request-Id higher priority than traceparent', () => {
    expect(
      resolveRequestIdFromHeaders(
        {
          'x-request-id': 'preferred-request-id',
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00',
        },
        () => 'generated',
      ),
    ).toBe('preferred-request-id');
  });

  it('generates a request id when no incoming id is usable', () => {
    expect(resolveRequestIdFromHeaders({}, () => 'generated-id')).toBe('generated-id');
  });

  it('rejects an all-zero trace id', () => {
    expect(
      extractTraceIdFromTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-00'),
    ).toBeNull();
  });

  it('rejects malformed traceparent values', () => {
    expect(extractTraceIdFromTraceparent('not-a-traceparent')).toBeNull();
    expect(
      extractTraceIdFromTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-short-00'),
    ).toBeNull();
    expect(
      extractTraceIdFromTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7'),
    ).toBeNull();
  });
});
