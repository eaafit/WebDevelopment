import type express from 'express';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { DocumentStorageUnavailableError } from '@internal/document';
import { handleDocumentContentRequest } from './document-content-route';

describe('handleDocumentContentRequest', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prepares a valid document stream without leaking signed-url or file values into spans', async () => {
    const tracing = mockTracer();
    const body = { pipe: jest.fn() };
    const req = buildRequest({
      documentId: '33333333-3333-4333-8333-333333333333',
      query: {
        mode: 'download',
        expires: '1800000000',
        signature: 'secret-signature',
      },
    });
    const res = buildResponse();
    const services = {
      documentFileUrlService: {
        validateAccess: jest.fn().mockReturnValue({ mode: 'download' }),
      },
      documentService: {
        getDocumentFile: jest.fn().mockReturnValue({
          fileName: 'signed-report.pdf',
          fileType: 'application/pdf',
          fileSize: 2048,
          objectKey: 'documents/private/signed-report.pdf',
          body,
        }),
      },
    };

    await handleDocumentContentRequest(req, res, services as never);

    expect(services.documentFileUrlService.validateAccess).toHaveBeenCalledWith({
      documentId: '33333333-3333-4333-8333-333333333333',
      mode: 'download',
      expires: '1800000000',
      signature: 'secret-signature',
    });
    expect(services.documentService.getDocumentFile).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=3600');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="signed-report.pdf"; filename*=UTF-8''signed-report.pdf`,
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', '2048');
    expect(body.pipe).toHaveBeenCalledWith(res);

    const routeSpan = tracing.spans.get('DocumentContentRoute.prepareStream');
    expect(routeSpan?.setAttribute).toHaveBeenCalledWith(
      'document.content.prepare_result',
      'prepared',
    );
    expect(routeSpan?.setAttribute).toHaveBeenCalledWith('notary.result', 'success');
    expect(routeSpan?.setStatus).not.toHaveBeenCalled();
    expectNoSpanLeak(tracing, [
      '33333333-3333-4333-8333-333333333333',
      'secret-signature',
      'signed-report.pdf',
      'documents/private/signed-report.pdf',
    ]);
  });

  it('marks denied signed-url validation as a failed prepare span without leaking query values', async () => {
    const tracing = mockTracer();
    const req = buildRequest({
      documentId: '11111111-1111-4111-8111-111111111111',
      query: {
        mode: 'download',
        expires: '1800000000',
        signature: 'secret-signature',
      },
    });
    const res = buildResponse();
    const services = {
      documentFileUrlService: {
        validateAccess: jest.fn().mockReturnValue(null),
      },
      documentService: {
        getDocumentFile: jest.fn(),
      },
    };

    await handleDocumentContentRequest(req, res, services as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid or expired document url' });
    expect(services.documentService.getDocumentFile).not.toHaveBeenCalled();
    const routeSpan = tracing.spans.get('DocumentContentRoute.prepareStream');
    expect(routeSpan?.setAttribute).toHaveBeenCalledWith(
      'document.content.prepare_result',
      'access_denied',
    );
    expect(routeSpan?.setAttribute).toHaveBeenCalledWith('notary.result', 'error');
    expect(routeSpan?.setAttribute).not.toHaveBeenCalledWith('notary.result', 'success');
    expect(routeSpan?.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: 'Error',
    });
    expectNoSpanLeak(tracing, [
      'secret-signature',
      '11111111-1111-4111-8111-111111111111',
    ]);
  });

  it('marks missing document files as failed not_found prepares without leaking identifiers', async () => {
    const tracing = mockTracer();
    const req = buildRequest({
      documentId: '44444444-4444-4444-8444-444444444444',
      query: {
        mode: 'preview',
        expires: '1800000000',
        signature: 'secret-signature',
      },
    });
    const res = buildResponse();
    const services = {
      documentFileUrlService: {
        validateAccess: jest.fn().mockReturnValue({ mode: 'preview' }),
      },
      documentService: {
        getDocumentFile: jest.fn().mockReturnValue(null),
      },
    };

    await handleDocumentContentRequest(req, res, services as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'document 44444444-4444-4444-8444-444444444444 not found',
    });
    const routeSpan = tracing.spans.get('DocumentContentRoute.prepareStream');
    expect(routeSpan?.setAttribute).toHaveBeenCalledWith(
      'document.content.prepare_result',
      'not_found',
    );
    expect(routeSpan?.setAttribute).toHaveBeenCalledWith('notary.result', 'error');
    expect(routeSpan?.setAttribute).not.toHaveBeenCalledWith('notary.result', 'success');
    expect(routeSpan?.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: 'Error',
    });
    expectNoSpanLeak(tracing, [
      '44444444-4444-4444-8444-444444444444',
      'secret-signature',
    ]);
  });

  it('marks handled document open errors as failed without changing the error response', async () => {
    const tracing = mockTracer();
    const req = buildRequest({
      documentId: '22222222-2222-4222-8222-222222222222',
      query: {
        mode: 'preview',
        expires: '1800000000',
        signature: 'secret-signature',
      },
    });
    const res = buildResponse();
    const services = {
      documentFileUrlService: {
        validateAccess: jest.fn().mockReturnValue({ mode: 'preview' }),
      },
      documentService: {
        getDocumentFile: jest
          .fn()
          .mockRejectedValue(new DocumentStorageUnavailableError('storage unavailable')),
      },
    };

    await handleDocumentContentRequest(req, res, services as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'document object storage unavailable' });
    const routeSpan = tracing.spans.get('DocumentContentRoute.prepareStream');
    expect(routeSpan?.setAttribute).toHaveBeenCalledWith(
      'document.content.prepare_result',
      'error',
    );
    expect(routeSpan?.setAttribute).toHaveBeenCalledWith('notary.result', 'error');
    expect(routeSpan?.setAttribute).not.toHaveBeenCalledWith('notary.result', 'success');
    expect(routeSpan?.recordException).toHaveBeenCalledWith('DocumentStorageUnavailableError');
    expectNoSpanLeak(tracing, [
      'secret-signature',
      '22222222-2222-4222-8222-222222222222',
    ]);
  });
});

type TracedSpanMock = {
  end: jest.Mock;
  recordException: jest.Mock;
  setAttribute: jest.Mock;
  setStatus: jest.Mock;
};

function mockTracer(): {
  spans: Map<string, TracedSpanMock>;
  startSpan: jest.Mock;
} {
  const spans = new Map<string, TracedSpanMock>();
  const startSpan = jest.fn((spanName: string) => {
    const span = {
      end: jest.fn(),
      recordException: jest.fn(),
      setAttribute: jest.fn(),
      setStatus: jest.fn(),
    };
    spans.set(spanName, span);
    return span;
  });
  jest.spyOn(trace, 'getTracer').mockReturnValue({ startSpan } as never);

  return { spans, startSpan };
}

function expectNoSpanLeak(
  tracing: { spans: Map<string, TracedSpanMock>; startSpan: jest.Mock },
  blockedValues: string[],
): void {
  const payload = JSON.stringify({
    startSpan: tracing.startSpan.mock.calls.map(([, options]) => options?.attributes ?? {}),
    setAttribute: [...tracing.spans.values()].flatMap((span) => span.setAttribute.mock.calls),
  });

  for (const value of blockedValues) {
    expect(payload).not.toContain(value);
  }
}

function buildRequest(input: {
  documentId: string;
  query: Record<string, string>;
}): express.Request {
  return {
    params: { documentId: input.documentId },
    query: input.query,
  } as unknown as express.Request;
}

function buildResponse(): express.Response {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as express.Response;
}
