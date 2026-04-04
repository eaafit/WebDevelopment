import { Injectable } from '@nestjs/common';
import { DocumentService } from './document.service';
import type {
  CreateDocumentRequest,
  CreateDocumentResponse,
  DeleteDocumentRequest,
  DeleteDocumentResponse,
  GetDocumentRequest,
  GetDocumentResponse,
  ListDocumentsByAssessmentRequest,
  ListDocumentsByAssessmentResponse,
} from '@notary-portal/api-contracts';

@Injectable()
export class DocumentRpcService {
  constructor(private readonly documentService: DocumentService) {}

  readonly listDocumentsByAssessment = (
    r: ListDocumentsByAssessmentRequest,
  ): Promise<ListDocumentsByAssessmentResponse> =>
    this.documentService.listDocumentsByAssessment(r);
  readonly getDocument = (r: GetDocumentRequest): Promise<GetDocumentResponse> =>
    this.documentService.getDocument(r);
  readonly createDocument = (r: CreateDocumentRequest): Promise<CreateDocumentResponse> =>
    this.documentService.createDocument(r);
  readonly deleteDocument = (r: DeleteDocumentRequest): Promise<DeleteDocumentResponse> =>
    this.documentService.deleteDocument(r);
}
