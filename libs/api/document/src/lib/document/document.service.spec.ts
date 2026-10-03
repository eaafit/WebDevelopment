import { create } from '@bufbuild/protobuf';
import { requestContextStorage } from '@internal/auth-shared';
import { markSpanFailure, runInSpan, setSpanAttributes } from '@internal/tracing';
import { CreateDocumentRequestSchema } from '@notary-portal/api-contracts';
import { DocumentService } from './document.service';

jest.mock('@internal/tracing', () => {
  const actual = jest.requireActual<typeof import('@internal/tracing')>('@internal/tracing');
  const span = {
    end: jest.fn(),
    recordException: jest.fn(),
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
  };

  return {
    ...actual,
    markSpanFailure: jest.fn(),
    runInSpan: jest.fn((_spanName: string, _attributes: unknown, action: (span: unknown) => unknown) =>
      action(span),
    ),
    setSpanAttributes: jest.fn(),
  };
});

describe('DocumentService', () => {
  const repository = {
    assessmentExists: jest.fn(),
    createDocument: jest.fn(),
  };
  const storage = {
    saveFile: jest.fn(),
    deleteFile: jest.fn(),
  };
  const service = new DocumentService(repository as never, storage as never);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.assessmentExists.mockResolvedValue(true);
    storage.saveFile.mockResolvedValue({
      bucketName: 'documents',
      objectKey: 'private/object-key.pdf',
      fileSize: 3,
    });
  });

  it('marks a handled rollback deletion failure without replacing the create error', async () => {
    const createError = new Error('document create failed');
    const rollbackError = new Error('storage rollback failed');
    repository.createDocument.mockRejectedValue(createError);
    storage.deleteFile.mockRejectedValue(rollbackError);

    await expect(
      runAsApplicant(() =>
        service.createDocument(
          create(CreateDocumentRequestSchema, {
            assessmentId: '11111111-1111-4111-8111-111111111111',
            fileName: 'document.pdf',
            fileType: 'application/pdf',
            fileContent: new Uint8Array([1, 2, 3]),
          }),
        ),
      ),
    ).rejects.toBe(createError);

    expect(storage.deleteFile).toHaveBeenCalledWith({
      bucketName: 'documents',
      objectKey: 'private/object-key.pdf',
    });
    expect(markSpanFailure).toHaveBeenCalledWith(expect.anything(), rollbackError);
  });

  it('uses low-cardinality content type and size span attributes without changing storage input', async () => {
    const createError = new Error('document create failed');
    repository.createDocument.mockRejectedValue(createError);

    await expect(
      runAsApplicant(() =>
        service.createDocument(
          create(CreateDocumentRequestSchema, {
            assessmentId: '11111111-1111-4111-8111-111111111111',
            fileName: 'document.bin',
            fileType: 'application/x-private; token=secret-token',
            fileContent: new Uint8Array(2048),
          }),
        ),
      ),
    ).rejects.toBe(createError);

    expect(storage.saveFile).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'application/x-private; token=secret-token',
      }),
    );

    const spanAttributes = [
      ...jest.mocked(runInSpan).mock.calls.map((call) => call[1]),
      ...jest.mocked(setSpanAttributes).mock.calls.map((call) => call[1]),
    ];
    const payload = JSON.stringify(spanAttributes);

    expect(payload).toContain('unsupported');
    expect(payload).toContain('1kb_100kb');
    expect(payload).not.toContain('application/x-private');
    expect(payload).not.toContain('secret-token');
    expect(payload).not.toContain('document.size_bytes');
  });
});

function runAsApplicant<T>(callback: () => T): T {
  return requestContextStorage.run(
    {
      user: {
        sub: '22222222-2222-4222-8222-222222222222',
        email: 'applicant@example.com',
        role: 'Applicant',
        iat: 1,
        exp: 2,
      },
      metadata: { ip: null, userAgent: null },
    },
    callback,
  );
}
