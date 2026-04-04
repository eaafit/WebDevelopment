import { TestBed } from '@angular/core/testing';
import { createClient } from '@connectrpc/connect';
import { DocumentType } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { DocumentApiService } from './document-api.service';

jest.mock('@connectrpc/connect', () => ({
  createClient: jest.fn(),
}));

describe('DocumentApiService', () => {
  let service: DocumentApiService;
  let client: {
    listDocumentsByAssessment: jest.Mock;
    createDocument: jest.Mock;
    deleteDocument: jest.Mock;
  };

  const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

  beforeEach(() => {
    client = {
      listDocumentsByAssessment: jest.fn(),
      createDocument: jest.fn(),
      deleteDocument: jest.fn(),
    };

    createClientMock.mockReset();
    createClientMock.mockReturnValue(client as never);

    TestBed.configureTestingModule({
      providers: [DocumentApiService, { provide: RPC_TRANSPORT, useValue: {} }],
    });

    service = TestBed.inject(DocumentApiService);
  });

  it('should map stored documents by type', async () => {
    client.listDocumentsByAssessment.mockResolvedValue({
      documents: [
        createDocumentMessage({
          id: 'document-1',
          fileName: 'passport.pdf',
          fileType: 'application/pdf',
          documentType: DocumentType.OTHER,
        }),
        createDocumentMessage({
          id: 'document-2',
          fileName: 'front.jpg',
          fileType: 'image/jpeg',
          documentType: DocumentType.PHOTO,
        }),
        createDocumentMessage({
          id: 'document-3',
          fileName: 'plan.xlsx',
          fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          documentType: DocumentType.ADDITIONAL,
        }),
      ],
    });

    const documents = await service.listDocumentsByAssessment('assessment-7');

    expect(client.listDocumentsByAssessment).toHaveBeenCalledWith({
      assessmentId: 'assessment-7',
      pagination: {
        page: 1,
        limit: 100,
      },
    });
    expect(documents.map((document) => document.kind)).toEqual(['document', 'photo', 'additional']);
  });

  it('should upload files with matching document type', async () => {
    client.createDocument.mockResolvedValue({
      document: createDocumentMessage({
        fileName: 'plan.xlsx',
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        documentType: DocumentType.ADDITIONAL,
      }),
    });

    const file = new File(['sheet'], 'plan.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }) as File & { arrayBuffer: () => Promise<ArrayBuffer> };
    file.arrayBuffer = async () => new TextEncoder().encode('sheet').buffer;
    const document = await service.uploadDocument({
      assessmentId: 'assessment-7',
      file,
      group: 'additional',
    });

    expect(client.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentId: 'assessment-7',
        fileName: 'plan.xlsx',
        documentType: DocumentType.ADDITIONAL,
        fileContent: expect.any(Uint8Array),
      }),
    );
    expect(document.kind).toBe('additional');
  });

  it('should delete stored documents by id', async () => {
    await service.deleteDocument('document-7');

    expect(client.deleteDocument).toHaveBeenCalledWith({ id: 'document-7' });
  });
});

function createDocumentMessage(overrides: Partial<Record<string, unknown>>) {
  return {
    id: 'document-1',
    assessmentId: 'assessment-7',
    fileName: 'document.pdf',
    fileType: 'application/pdf',
    fileSize: 1024,
    bucketName: 'assessment-files',
    objectKey: 'documents/assessment-7/uuid.pdf',
    previewUrl: '/api/documents/document-1/content?mode=preview',
    downloadUrl: '/api/documents/document-1/content?mode=download',
    version: 1,
    uploadedAt: undefined,
    uploadedById: USER_ID,
    documentType: DocumentType.OTHER,
    ...overrides,
  };
}

const USER_ID = '11111111-1111-4111-8111-111111111111';
