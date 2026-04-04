import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  AssessmentStatus,
  CancelAssessmentResponseSchema,
  CompleteAssessmentResponseSchema,
  CreateAssessmentResponseSchema,
  ElevatorType,
  RealEstateCondition,
  RealEstateObjectType,
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
  type ListCitiesRequest,
  type ListCitiesResponse,
  type ListDistrictsRequest,
  type ListDistrictsResponse,
  type RealEstateObjectInput,
  type UpdateAssessmentRequest,
  type UpdateAssessmentResponse,
  type VerifyAssessmentRequest,
  type VerifyAssessmentResponse,
  UpdateAssessmentResponseSchema,
  VerifyAssessmentResponseSchema,
  WallMaterial,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';
import { MetricsService } from '@internal/metrics';
import { AssessmentRepository, type AssessmentRealEstateObjectData } from './assessment.repository';
import type { AssessmentQuery } from './assessment.query';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

@Injectable()
export class AssessmentService {
  constructor(
    private readonly assessmentRepository: AssessmentRepository,
    private readonly metrics: MetricsService,
  ) {}

  listCities(request: ListCitiesRequest): Promise<ListCitiesResponse> {
    void request;
    return this.assessmentRepository.listCities();
  }

  listDistricts(request: ListDistrictsRequest): Promise<ListDistrictsResponse> {
    return this.assessmentRepository.listDistricts(
      normalizeOptionalUuid(request.cityId, 'city_id'),
    );
  }

  listAssessments(request: ListAssessmentsRequest): Promise<ListAssessmentsResponse> {
    return this.assessmentRepository.listAssessments(this.normalizeListRequest(request));
  }

  getAssessment(request: GetAssessmentRequest): Promise<GetAssessmentResponse> {
    validateUuid(request.id, 'id');
    return this.assessmentRepository.getAssessment(request.id);
  }

  async createAssessment(request: CreateAssessmentRequest): Promise<CreateAssessmentResponse> {
    validateUuid(request.userId, 'user_id');

    const realEstateObject = normalizeRealEstateObjectInput(request.realEstateObject, 'create');
    const address = realEstateObject?.address ?? normalizeRequiredText(request.address, 'address');

    const assessment = await this.assessmentRepository.createAssessment({
      userId: request.userId,
      address,
      description: normalizeOptionalText(request.description),
      realEstateObject,
    });

    this.metrics.recordAssessmentCreated('new');

    return create(CreateAssessmentResponseSchema, { assessment });
  }

  async updateAssessment(request: UpdateAssessmentRequest): Promise<UpdateAssessmentResponse> {
    validateUuid(request.id, 'id');

    const realEstateObject = normalizeRealEstateObjectInput(request.realEstateObject, 'update');
    const assessment = await this.assessmentRepository.updateAssessment(request.id, {
      address: realEstateObject?.address ?? normalizeOptionalText(request.address),
      description: request.description.trim(),
      realEstateObject,
    });

    return create(UpdateAssessmentResponseSchema, { assessment });
  }

  async verifyAssessment(request: VerifyAssessmentRequest): Promise<VerifyAssessmentResponse> {
    validateUuid(request.id, 'id');

    const assessment = await this.assessmentRepository.verifyAssessment(request.id);

    return create(VerifyAssessmentResponseSchema, { assessment });
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

    return create(CompleteAssessmentResponseSchema, { assessment });
  }

  async cancelAssessment(request: CancelAssessmentRequest): Promise<CancelAssessmentResponse> {
    validateUuid(request.id, 'id');

    const assessment = await this.assessmentRepository.cancelAssessment(
      request.id,
      request.reason?.trim() || undefined,
    );

    return create(CancelAssessmentResponseSchema, { assessment });
  }

  private normalizeListRequest(request: ListAssessmentsRequest): AssessmentQuery {
    const pagination = request.pagination;

    return {
      page: normalizePositiveInt(pagination?.page, DEFAULT_PAGE),
      limit: normalizePositiveInt(pagination?.limit, DEFAULT_LIMIT),
      userId: request.userId || undefined,
      status:
        request.statusFilter === AssessmentStatus.UNSPECIFIED ? undefined : request.statusFilter,
    };
  }
}

function validateUuid(value: string | undefined, fieldName: string): void {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new ConnectError(`${fieldName} must be a valid UUID`, Code.InvalidArgument);
  }
}

function normalizeOptionalUuid(value: string | undefined, fieldName: string): string | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!normalized || !UUID_PATTERN.test(normalized)) {
    throw new ConnectError(`${fieldName} must be a valid UUID`, Code.InvalidArgument);
  }

  return normalized;
}

function normalizeNullableUuid(
  value: string | undefined,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!normalized) return null;
  if (!UUID_PATTERN.test(normalized)) {
    throw new ConnectError(`${fieldName} must be a valid UUID`, Code.InvalidArgument);
  }

  return normalized;
}

function normalizeRequiredText(value: string | undefined, fieldName: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new ConnectError(`${fieldName} is required`, Code.InvalidArgument);
  }
  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalRequiredText(
  value: string | undefined,
  fieldName: string,
): string | undefined {
  if (value === undefined) return undefined;
  return normalizeRequiredText(value, fieldName);
}

function normalizeNullableText(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalDecimal(
  value: string | undefined,
  fieldName: string,
): string | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim();
  if (!normalized) {
    throw new ConnectError(`${fieldName} is required`, Code.InvalidArgument);
  }

  if (!DECIMAL_PATTERN.test(normalized) || Number(normalized) <= 0) {
    throw new ConnectError(
      `${fieldName} must be a valid positive decimal number`,
      Code.InvalidArgument,
    );
  }

  return normalized;
}

function normalizeOptionalInteger(
  value: number | undefined,
  fieldName: string,
  minimum: number,
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < minimum) {
    throw new ConnectError(
      `${fieldName} must be an integer greater than or equal to ${minimum}`,
      Code.InvalidArgument,
    );
  }
  return value;
}

function normalizeRequiredEnum<T extends number>(
  value: T | undefined,
  unspecifiedValue: T,
  fieldName: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (value === unspecifiedValue) {
    throw new ConnectError(`${fieldName} must be specified`, Code.InvalidArgument);
  }
  return value;
}

function normalizeNullableEnum<T extends number>(
  value: T | undefined,
  unspecifiedValue: T,
): T | null | undefined {
  if (value === undefined) return undefined;
  return value === unspecifiedValue ? null : value;
}

function normalizeRealEstateObjectInput(
  input: RealEstateObjectInput | undefined,
  mode: 'create' | 'update',
): AssessmentRealEstateObjectData | undefined {
  if (!input || !hasRealEstateObjectInputData(input)) {
    return undefined;
  }

  const realEstateObject: AssessmentRealEstateObjectData = {};

  const cityId = normalizeOptionalUuid(input.cityId, 'real_estate_object.city_id');
  if (cityId !== undefined) realEstateObject.cityId = cityId;

  const districtId = normalizeNullableUuid(input.districtId, 'real_estate_object.district_id');
  if (districtId !== undefined) realEstateObject.districtId = districtId;

  const address = normalizeOptionalRequiredText(input.address, 'real_estate_object.address');
  if (address !== undefined) realEstateObject.address = address;

  const cadastralNumber = normalizeNullableText(input.cadastralNumber);
  if (cadastralNumber !== undefined) realEstateObject.cadastralNumber = cadastralNumber;

  const area = normalizeOptionalDecimal(input.area, 'real_estate_object.area');
  if (area !== undefined) realEstateObject.area = area;

  const objectType = normalizeRequiredEnum(
    input.objectType,
    RealEstateObjectType.UNSPECIFIED,
    'real_estate_object.object_type',
  );
  if (objectType !== undefined) realEstateObject.objectType = objectType;

  const roomsCount = normalizeOptionalInteger(
    input.roomsCount,
    'real_estate_object.rooms_count',
    0,
  );
  if (roomsCount !== undefined) realEstateObject.roomsCount = roomsCount;

  const floorsTotal = normalizeOptionalInteger(
    input.floorsTotal,
    'real_estate_object.floors_total',
    1,
  );
  if (floorsTotal !== undefined) realEstateObject.floorsTotal = floorsTotal;

  const floor = normalizeOptionalInteger(input.floor, 'real_estate_object.floor', 0);
  if (floor !== undefined) realEstateObject.floor = floor;

  const condition = normalizeNullableEnum(input.condition, RealEstateCondition.UNSPECIFIED);
  if (condition !== undefined) realEstateObject.condition = condition;

  const yearBuilt = normalizeOptionalInteger(input.yearBuilt, 'real_estate_object.year_built', 1);
  if (yearBuilt !== undefined) realEstateObject.yearBuilt = yearBuilt;

  const wallMaterial = normalizeNullableEnum(input.wallMaterial, WallMaterial.UNSPECIFIED);
  if (wallMaterial !== undefined) realEstateObject.wallMaterial = wallMaterial;

  const elevatorType = normalizeNullableEnum(input.elevatorType, ElevatorType.UNSPECIFIED);
  if (elevatorType !== undefined) realEstateObject.elevatorType = elevatorType;

  if (input.hasBalconyOrLoggia !== undefined) {
    realEstateObject.hasBalconyOrLoggia = input.hasBalconyOrLoggia;
  }

  const landCategory = normalizeNullableText(input.landCategory);
  if (landCategory !== undefined) realEstateObject.landCategory = landCategory;

  const permittedUse = normalizeNullableText(input.permittedUse);
  if (permittedUse !== undefined) realEstateObject.permittedUse = permittedUse;

  const utilities = normalizeNullableText(input.utilities);
  if (utilities !== undefined) realEstateObject.utilities = utilities;

  const description = normalizeNullableText(input.description);
  if (description !== undefined) realEstateObject.description = description;

  if (mode === 'create') {
    assertDefined(realEstateObject.cityId, 'real_estate_object.city_id');
    assertDefined(realEstateObject.address, 'real_estate_object.address');
    assertDefined(realEstateObject.area, 'real_estate_object.area');
    assertDefined(realEstateObject.objectType, 'real_estate_object.object_type');
  }

  return realEstateObject;
}

function hasRealEstateObjectInputData(input: RealEstateObjectInput): boolean {
  return (
    input.cityId !== undefined ||
    input.districtId !== undefined ||
    input.address !== undefined ||
    input.cadastralNumber !== undefined ||
    input.area !== undefined ||
    input.objectType !== undefined ||
    input.roomsCount !== undefined ||
    input.floorsTotal !== undefined ||
    input.floor !== undefined ||
    input.condition !== undefined ||
    input.yearBuilt !== undefined ||
    input.wallMaterial !== undefined ||
    input.elevatorType !== undefined ||
    input.hasBalconyOrLoggia !== undefined ||
    input.landCategory !== undefined ||
    input.permittedUse !== undefined ||
    input.utilities !== undefined ||
    input.description !== undefined
  );
}

function assertDefined<T>(value: T | undefined, fieldName: string): asserts value is T {
  if (value === undefined) {
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
