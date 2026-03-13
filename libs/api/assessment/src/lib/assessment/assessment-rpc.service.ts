import { Injectable } from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import type {
  CancelAssessmentRequest,
  CancelAssessmentResponse,
  CompleteAssessmentRequest,
  CompleteAssessmentResponse,
  CreateAssessmentRequest,
  CreateAssessmentResponse,
  GetAssessmentRequest,
  GetAssessmentResponse,
  ListAssessmentsRequest,
  ListAssessmentsResponse,
  UpdateAssessmentRequest,
  UpdateAssessmentResponse,
  VerifyAssessmentRequest,
  VerifyAssessmentResponse,
} from '@notary-portal/api-contracts';

@Injectable()
export class AssessmentRpcService {
  constructor(private readonly assessmentService: AssessmentService) {}

  readonly listAssessments = (r: ListAssessmentsRequest): Promise<ListAssessmentsResponse> =>
    this.assessmentService.listAssessments(r);

  readonly getAssessment = (r: GetAssessmentRequest): Promise<GetAssessmentResponse> =>
    this.assessmentService.getAssessment(r);

  readonly createAssessment = (r: CreateAssessmentRequest): Promise<CreateAssessmentResponse> =>
    this.assessmentService.createAssessment(r);

  readonly updateAssessment = (r: UpdateAssessmentRequest): Promise<UpdateAssessmentResponse> =>
    this.assessmentService.updateAssessment(r);

  readonly verifyAssessment = (r: VerifyAssessmentRequest): Promise<VerifyAssessmentResponse> =>
    this.assessmentService.verifyAssessment(r);

  readonly completeAssessment = (
    r: CompleteAssessmentRequest,
  ): Promise<CompleteAssessmentResponse> => this.assessmentService.completeAssessment(r);

  readonly cancelAssessment = (r: CancelAssessmentRequest): Promise<CancelAssessmentResponse> =>
    this.assessmentService.cancelAssessment(r);
}
