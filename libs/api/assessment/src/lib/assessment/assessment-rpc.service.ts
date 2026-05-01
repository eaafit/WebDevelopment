import { Code, ConnectError } from '@connectrpc/connect';
import { Injectable, Logger } from '@nestjs/common';
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
  ListCitiesRequest,
  ListCitiesResponse,
  ListAssessmentsRequest,
  ListAssessmentsResponse,
  ListDistrictsRequest,
  ListDistrictsResponse,
  UpdateAssessmentRequest,
  UpdateAssessmentResponse,
  VerifyAssessmentRequest,
  VerifyAssessmentResponse,
} from '@notary-portal/api-contracts';

@Injectable()
export class AssessmentRpcService {
  private readonly logger = new Logger(AssessmentRpcService.name);

  constructor(private readonly assessmentService: AssessmentService) {}

  readonly listCities = (r: ListCitiesRequest): Promise<ListCitiesResponse> =>
    this.handleRpcCall('listCities', () => this.assessmentService.listCities(r));

  readonly listDistricts = (r: ListDistrictsRequest): Promise<ListDistrictsResponse> =>
    this.handleRpcCall('listDistricts', () => this.assessmentService.listDistricts(r));

  readonly listAssessments = (r: ListAssessmentsRequest): Promise<ListAssessmentsResponse> =>
    this.handleRpcCall('listAssessments', () => this.assessmentService.listAssessments(r));

  readonly getAssessment = (r: GetAssessmentRequest): Promise<GetAssessmentResponse> =>
    this.handleRpcCall('getAssessment', () => this.assessmentService.getAssessment(r));

  readonly createAssessment = (r: CreateAssessmentRequest): Promise<CreateAssessmentResponse> =>
    this.handleRpcCall('createAssessment', () => this.assessmentService.createAssessment(r));

  readonly updateAssessment = (r: UpdateAssessmentRequest): Promise<UpdateAssessmentResponse> =>
    this.handleRpcCall('updateAssessment', () => this.assessmentService.updateAssessment(r));

  readonly verifyAssessment = (r: VerifyAssessmentRequest): Promise<VerifyAssessmentResponse> =>
    this.handleRpcCall('verifyAssessment', () => this.assessmentService.verifyAssessment(r));

  readonly completeAssessment = (
    r: CompleteAssessmentRequest,
  ): Promise<CompleteAssessmentResponse> =>
    this.handleRpcCall('completeAssessment', () => this.assessmentService.completeAssessment(r));

  readonly cancelAssessment = (r: CancelAssessmentRequest): Promise<CancelAssessmentResponse> =>
    this.handleRpcCall('cancelAssessment', () => this.assessmentService.cancelAssessment(r));

  private async handleRpcCall<T>(operation: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (isExpectedRpcError(error)) {
        this.logger.warn(`Assessment RPC ${operation} rejected request: ${errorMessage(error)}`);
      } else {
        this.logger.error(
          `Assessment RPC ${operation} failed: ${errorMessage(error)}`,
          errorStack(error),
        );
      }
      throw error;
    }
  }
}

function isExpectedRpcError(error: unknown): boolean {
  return (
    (error instanceof ConnectError &&
      (error.code === Code.InvalidArgument || error.code === Code.NotFound)) ||
    isPrismaNotFoundError(error)
  );
}

function isPrismaNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
