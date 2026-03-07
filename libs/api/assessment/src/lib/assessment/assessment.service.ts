import { Code, ConnectError } from '@connectrpc/connect';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import {
  AssessmentStatus,
  type CancelAssessmentRequest,
  type CancelAssessmentResponse,
  type CompleteAssessmentRequest,
  type CompleteAssessmentResponse,
  type CreateAssessmentRequest,
  type CreateAssessmentResponse,
  type GetAssessmentRequest,
  type GetAssessmentResponse,
  type ListAssessmentsRequest,
  type ListAssessmentsResponse,
  type UpdateAssessmentRequest,
  type UpdateAssessmentResponse,
  type VerifyAssessmentRequest,
  type VerifyAssessmentResponse,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';
import { AssessmentRepository } from './assessment.repository';
import type { AssessmentQuery } from './assessment.query';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
/** UUID v1–v5 format: 8-4-4-4-12 hex digits with version/variant bits */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Decimal: optional integer part, optional decimal part with 1–2 digits (e.g. 123 or 12.34) */
const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

@Injectable()
export class AssessmentService {
  constructor(private readonly assessmentRepository: AssessmentRepository) {}

  listAssessments(request: ListAssessmentsRequest): Promise<ListAssessmentsResponse> {
    return this.assessmentRepository.listAssessments(this.normalizeListRequest(request));
  }

  getAssessment(request: GetAssessmentRequest): Promise<GetAssessmentResponse> {
    validateUuid(request.id, 'id');
    return this.assessmentRepository.getAssessment(request.id);
  }

  async createAssessment(request: CreateAssessmentRequest): Promise<CreateAssessmentResponse> {
    validateUuid(request.userId, 'user_id');
    validateRequired(request.address, 'address');

    const assessment = await this.assessmentRepository.createAssessment({
      userId: request.userId,
      address: request.address.trim(),
      description: request.description?.trim() || undefined,
    });

    return { assessment };
  }

  async updateAssessment(request: UpdateAssessmentRequest): Promise<UpdateAssessmentResponse> {
    validateUuid(request.id, 'id');

    const assessment = await this.assessmentRepository.updateAssessment(request.id, {
      address: request.address?.trim() || undefined,
      description: request.description?.trim(),
    });

    return { assessment };
  }

  async verifyAssessment(request: VerifyAssessmentRequest): Promise<VerifyAssessmentResponse> {
    validateUuid(request.id, 'id');
    validateUuid(request.notaryId, 'notary_id');

    const assessment = await this.assessmentRepository.verifyAssessment(
      request.id,
      request.notaryId,
    );

    return { assessment };
  }

  async completeAssessment(
    request: CompleteAssessmentRequest,
  ): Promise<CompleteAssessmentResponse> {
    validateUuid(request.id, 'id');

    if (!DECIMAL_PATTERN.test(request.finalEstimatedValue)) {
      throw new ConnectError(
        'final_estimated_value must be a valid decimal number',
        Code.InvalidArgument,
      );
    }

    const assessment = await this.assessmentRepository.completeAssessment(
      request.id,
      request.finalEstimatedValue,
    );

    return { assessment };
  }

  async cancelAssessment(request: CancelAssessmentRequest): Promise<CancelAssessmentResponse> {
    validateUuid(request.id, 'id');

    const assessment = await this.assessmentRepository.cancelAssessment(
      request.id,
      request.reason?.trim() || undefined,
    );

    return { assessment };
  }

  private normalizeListRequest(request: ListAssessmentsRequest): AssessmentQuery {
    const pagination = request.pagination;
    const filters = request.filters;
    const sort = request.sort;

    const dateFrom = filters?.createdAtRange?.startDate
      ? timestampDate(filters.createdAtRange.startDate)
      : undefined;
    const dateTo = filters?.createdAtRange?.endDate
      ? timestampDate(filters.createdAtRange.endDate)
      : undefined;

    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new ConnectError(
        'filters.created_at_range: start_date must be earlier than end_date',
        Code.InvalidArgument,
      );
    }

    return {
      page: normalizePositiveInt(pagination?.page, DEFAULT_PAGE),
      limit: normalizePositiveInt(pagination?.limit, DEFAULT_LIMIT),
      userId: filters?.userId || undefined,
      notaryId: filters?.notaryId || undefined,
      status:
        filters?.status === AssessmentStatus.ASSESSMENT_STATUS_UNSPECIFIED
          ? undefined
          : filters?.status,
      createdAtFrom: dateFrom,
      createdAtTo: dateTo,
      sortField: normalizeSortField(sort?.field),
      sortDesc: sort?.descending ?? false,
    };
  }
}

function validateUuid(value: string | undefined, fieldName: string): void {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new ConnectError(`${fieldName} must be a valid UUID`, Code.InvalidArgument);
  }
}

function validateRequired(value: string | undefined, fieldName: string): void {
  if (!value?.trim()) {
    throw new ConnectError(`${fieldName} is required`, Code.InvalidArgument);
  }
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (value === undefined || value === 0) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new ConnectError(
      'pagination page and limit must be positive integers',
      Code.InvalidArgument,
    );
  }
  return value;
}

function normalizeSortField(
  field?: number,
): 'createdAt' | 'estimatedValue' | 'updatedAt' | undefined {
  switch (field) {
    case 1:
      return 'createdAt';
    case 2:
      return 'estimatedValue';
    case 3:
      return 'updatedAt';
    default:
      return undefined;
  }
}
