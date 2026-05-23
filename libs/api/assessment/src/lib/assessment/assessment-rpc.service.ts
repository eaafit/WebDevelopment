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
  GetFiasAddressDetailsRequest,
  GetFiasAddressDetailsResponse,
  GetFiasAddressHintsRequest,
  GetFiasAddressHintsResponse,
  GetFiasAddressItemByGuidRequest,
  GetFiasAddressItemByGuidResponse,
  GetFiasAddressItemByIdRequest,
  GetFiasAddressItemByIdResponse,
  GetAssessmentRequest,
  GetAssessmentResponse,
  ListCitiesRequest,
  ListCitiesResponse,
  ListAssessmentsRequest,
  ListAssessmentsResponse,
  ListDistrictsRequest,
  ListDistrictsResponse,
  LogApplicantAssessmentActionRequest,
  LogApplicantAssessmentActionResponse,
  SearchFiasAddressByPartsRequest,
  SearchFiasAddressByPartsResponse,
  SearchFiasAddressItemsRequest,
  SearchFiasAddressItemsResponse,
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

  readonly getFiasAddressHints = (
    r: GetFiasAddressHintsRequest,
  ): Promise<GetFiasAddressHintsResponse> =>
    this.handleRpcCall('getFiasAddressHints', () =>
      this.assessmentService.getFiasAddressHints(r),
    );

  readonly searchFiasAddressItems = (
    r: SearchFiasAddressItemsRequest,
  ): Promise<SearchFiasAddressItemsResponse> =>
    this.handleRpcCall('searchFiasAddressItems', () =>
      this.assessmentService.searchFiasAddressItems(r),
    );

  readonly getFiasAddressItemById = (
    r: GetFiasAddressItemByIdRequest,
  ): Promise<GetFiasAddressItemByIdResponse> =>
    this.handleRpcCall('getFiasAddressItemById', () =>
      this.assessmentService.getFiasAddressItemById(r),
    );

  readonly getFiasAddressItemByGuid = (
    r: GetFiasAddressItemByGuidRequest,
  ): Promise<GetFiasAddressItemByGuidResponse> =>
    this.handleRpcCall('getFiasAddressItemByGuid', () =>
      this.assessmentService.getFiasAddressItemByGuid(r),
    );

  readonly getFiasAddressDetails = (
    r: GetFiasAddressDetailsRequest,
  ): Promise<GetFiasAddressDetailsResponse> =>
    this.handleRpcCall('getFiasAddressDetails', () =>
      this.assessmentService.getFiasAddressDetails(r),
    );

  readonly searchFiasAddressByParts = (
    r: SearchFiasAddressByPartsRequest,
  ): Promise<SearchFiasAddressByPartsResponse> =>
    this.handleRpcCall('searchFiasAddressByParts', () =>
      this.assessmentService.searchFiasAddressByParts(r),
    );

  readonly logApplicantAssessmentAction = (
    r: LogApplicantAssessmentActionRequest,
  ): Promise<LogApplicantAssessmentActionResponse> =>
    this.handleRpcCall('logApplicantAssessmentAction', async () =>
      this.assessmentService.logApplicantAssessmentAction(r),
    );

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
    this.logger.log(`Starting assessment RPC ${operation}`);

    try {
      const response = await action();
      this.logger.log(`Completed assessment RPC ${operation}`);
      return response;
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
