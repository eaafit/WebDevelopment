import { Code, ConnectError } from '@connectrpc/connect';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import {
  SpanKind,
  markSpanFailure,
  normalizeSpanContentType,
  normalizeSpanActorRole,
  runInSpan,
  sanitizeSpanAttributes,
  spanErrorStatusMessage,
  spanSizeBucket,
} from './tracing';

describe('runInSpan', () => {
  let span: {
    end: jest.Mock;
    recordException: jest.Mock;
    setAttribute: jest.Mock;
    setStatus: jest.Mock;
  };
  let tracer: { startSpan: jest.Mock };
  let getTracerSpy: jest.SpyInstance;

  beforeEach(() => {
    span = {
      end: jest.fn(),
      recordException: jest.fn(),
      setAttribute: jest.fn(),
      setStatus: jest.fn(),
    };
    tracer = {
      startSpan: jest.fn(() => span),
    };
    getTracerSpy = jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a success span and returns action result', async () => {
    const result = await runInSpan('test.success', { 'notary.operation': 'test' }, () => 42);

    expect(result).toBe(42);
    expect(getTracerSpy).toHaveBeenCalled();
    expect(tracer.startSpan).toHaveBeenCalledWith(
      'test.success',
      expect.objectContaining({
        attributes: { 'notary.operation': 'test' },
      }),
      expect.anything(),
    );
    expect(span.setAttribute).toHaveBeenCalledWith('notary.result', 'success');
    expect(span.setStatus).not.toHaveBeenCalled();
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it('preserves the zero-valued internal span kind', async () => {
    await runInSpan('test.internal', { 'notary.operation': 'test' }, () => undefined, {
      kind: SpanKind.INTERNAL,
    });

    expect(tracer.startSpan).toHaveBeenCalledWith(
      'test.internal',
      expect.objectContaining({ kind: SpanKind.INTERNAL }),
      expect.anything(),
    );
  });

  it('records an error span and rethrows', async () => {
    const error = new Error('boom');

    await expect(
      runInSpan('test.error', { 'notary.operation': 'test' }, () => {
        throw error;
      }),
    ).rejects.toThrow(error);

    expect(span.recordException).toHaveBeenCalledWith('Error');
    expect(span.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: 'Error',
    });
    expect(span.setAttribute).toHaveBeenCalledWith('notary.result', 'error');
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it('keeps handled span failures marked as errors', async () => {
    const error = new Error('handled');

    const result = await runInSpan('test.handled_error', { 'notary.operation': 'test' }, (span) => {
      markSpanFailure(span, error);
      return 'handled';
    });

    expect(result).toBe('handled');
    expect(span.recordException).toHaveBeenCalledWith('Error');
    expect(span.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: 'Error',
    });
    expect(span.setAttribute).toHaveBeenCalledWith('notary.result', 'error');
    expect(span.setAttribute).not.toHaveBeenCalledWith('notary.result', 'success');
    expect(span.end).toHaveBeenCalledTimes(1);
  });

  it('uses safe ConnectError and HttpException status messages', () => {
    expect(spanErrorStatusMessage(new ConnectError('invalid', Code.InvalidArgument))).toBe(
      `ConnectError:${Code.InvalidArgument}`,
    );
    expect(spanErrorStatusMessage(new HttpException('nope', HttpStatus.FORBIDDEN))).toBe(
      'HttpException:403',
    );
  });

  it('records only safe exception labels without raw error message or stack', async () => {
    const rawError = new Error(
      'Failed for user test@example.com token=secret-token objectKey=payment-documents/11111111-1111-4111-8111-111111111111/file.pdf',
    );

    await expect(
      runInSpan('test.safe_error_recording', { 'notary.operation': 'test' }, () => {
        throw rawError;
      }),
    ).rejects.toThrow(rawError);

    expect(span.recordException).toHaveBeenCalledWith('Error');
    expect(span.recordException).not.toHaveBeenCalledWith(rawError);

    const recordedPayload = JSON.stringify(span.recordException.mock.calls);
    const rawStack = rawError.stack ?? '';
    expect(recordedPayload).not.toContain('test@example.com');
    expect(recordedPayload).not.toContain('secret-token');
    expect(recordedPayload).not.toContain('payment-documents');
    expect(recordedPayload).not.toContain('11111111-1111-4111-8111-111111111111');
    if (rawStack) {
      expect(recordedPayload).not.toContain(rawStack);
    }
  });

  it('records safe ConnectError labels without raw sensitive message', () => {
    const error = new ConnectError(
      'bad token=secret-token email=test@example.com objectKey=payment-documents/raw-key',
      Code.PermissionDenied,
    );

    markSpanFailure(span as never, error);

    expect(span.recordException).toHaveBeenCalledWith(`ConnectError:${Code.PermissionDenied}`);
    expect(span.recordException).not.toHaveBeenCalledWith(error);

    const recordedPayload = JSON.stringify(span.recordException.mock.calls);
    expect(recordedPayload).not.toContain('secret-token');
    expect(recordedPayload).not.toContain('test@example.com');
    expect(recordedPayload).not.toContain('payment-documents');
  });

  it('sanitizes empty attributes', () => {
    expect(
      sanitizeSpanAttributes({
        'notary.operation': 'assessment.create',
        empty: '',
        nil: null,
        missing: undefined,
      }),
    ).toEqual({ 'notary.operation': 'assessment.create' });
  });

  it('passes safe low-cardinality business and technical attributes through', () => {
    expect(
      sanitizeSpanAttributes({
        'http.response.status_code': 200,
        'db.operation': 'select',
        'document.content_type': 'text/html; charset=utf-8',
        'document.size_bucket': '1kb_100kb',
        'document.size_bytes': 12345,
        'payment.status.to': 'Completed',
        'notary.actor.role': 'USER_ROLE_ADMIN',
        'payment.has_promo': true,
        'bitrix.contact.has_email': true,
        'bitrix.contact.has_phone': false,
      }),
    ).toEqual({
      'http.response.status_code': 200,
      'db.operation': 'select',
      'document.content_type': 'text/html',
      'document.size_bucket': '1kb_100kb',
      'payment.status.to': 'Completed',
      'notary.actor.role': 'admin',
      'payment.has_promo': true,
      'bitrix.contact.has_email': true,
      'bitrix.contact.has_phone': false,
    });
  });

  it('does not pass obvious PII or high-cardinality attributes through', () => {
    expect(
      sanitizeSpanAttributes({
        email: 'test@example.com',
        userEmail: 'test@example.com',
        phoneNumber: '+7 999 000 00 00',
        fullName: 'Иван Иванов',
        rawAddress: 'Москва, улица Ленина, 1',
        token: 'secret-token',
        resetToken: 'secret-token',
        assessmentId: 'assessment-1',
        payment_id: 'payment-1',
        objectKey: 'documents/111/file.pdf',
        object_key: 'documents/111/file.pdf',
        fileName: 'passport.pdf',
        uuid_value: '11111111-1111-4111-8111-111111111111',
        candidate: 'test@example.com',
        sample_contact: '+7 999 000 00 00',
      }),
    ).toEqual({});
  });

  it('blocks full UUID and full id attributes but keeps safe status attributes', () => {
    expect(
      sanitizeSpanAttributes({
        traceId: '11111111-1111-4111-8111-111111111111',
        document_id: 'document-1',
        'payment.status.to': 'Failed',
      }),
    ).toEqual({
      'payment.status.to': 'Failed',
    });
  });
});

describe('span document attribute helpers', () => {
  it.each([
    ['application/pdf', 'application/pdf'],
    ['text/html; charset=utf-8', 'text/html'],
    ['IMAGE/JPG', 'image/jpeg'],
    ['image/png', 'image/png'],
    ['', 'unknown'],
    [undefined, 'unknown'],
    ['application/x-private; token=secret', 'unsupported'],
  ])('normalizes content type %p to %s', (input, expected) => {
    expect(normalizeSpanContentType(input)).toBe(expected);
  });

  it.each([
    [undefined, 'unknown'],
    [-1, 'unknown'],
    [0, 'zero'],
    [1, 'lt_1kb'],
    [1024, 'lt_1kb'],
    [1025, '1kb_100kb'],
    [100 * 1024 + 1, '100kb_1mb'],
    [1024 * 1024 + 1, '1mb_10mb'],
    [10 * 1024 * 1024 + 1, 'gt_10mb'],
  ])('buckets size %p as %s', (input, expected) => {
    expect(spanSizeBucket(input)).toBe(expected);
  });
});

describe('normalizeSpanActorRole', () => {
  it.each([
    [1, 'applicant'],
    ['1', 'applicant'],
    ['USER_ROLE_APPLICANT', 'applicant'],
    ['Applicant', 'applicant'],
    ['applicant', 'applicant'],
    [2, 'notary'],
    ['2', 'notary'],
    ['USER_ROLE_NOTARY', 'notary'],
    ['Notary', 'notary'],
    ['notary', 'notary'],
    [3, 'admin'],
    ['3', 'admin'],
    ['USER_ROLE_ADMIN', 'admin'],
    ['Admin', 'admin'],
    ['admin', 'admin'],
    ['system', 'system'],
    ['anonymous', 'anonymous'],
  ])('normalizes %p to %s', (input, expected) => {
    expect(normalizeSpanActorRole(input)).toBe(expected);
  });

  it('returns undefined for missing or unknown roles', () => {
    expect(normalizeSpanActorRole(undefined)).toBeUndefined();
    expect(normalizeSpanActorRole(null)).toBeUndefined();
    expect(normalizeSpanActorRole('')).toBeUndefined();
    expect(normalizeSpanActorRole('USER_ROLE_MANAGER')).toBeUndefined();
    expect(normalizeSpanActorRole(0)).toBeUndefined();
  });
});
