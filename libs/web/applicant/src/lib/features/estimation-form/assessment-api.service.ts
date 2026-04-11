import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  AssessmentService,
  AssessmentStatus,
  type Assessment,
  type RealEstateObject,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import type {
  AssessmentDraftModel,
  DistrictLookupOption,
  EstimationFormDraftData,
  LookupOption,
} from './estimation-form.models';

@Injectable({ providedIn: 'root' })
export class AssessmentApiService {
  private readonly client = createClient(AssessmentService, inject(RPC_TRANSPORT));

  async getAssessment(assessmentId: string): Promise<AssessmentDraftModel> {
    const response = await this.client.getAssessment({ id: assessmentId });
    return this.requireAssessment(response.assessment);
  }

  async findLatestDraft(userId: string): Promise<AssessmentDraftModel | null> {
    const response = await this.client.listAssessments({
      userId,
      statusFilter: AssessmentStatus.NEW,
      pagination: {
        page: 1,
        limit: 1,
      },
    });

    const assessment = response.assessments[0];
    return assessment ? this.toAssessmentDraftModel(assessment) : null;
  }

  async createDraft(userId: string, form: EstimationFormDraftData): Promise<AssessmentDraftModel> {
    const response = await this.client.createAssessment({
      userId,
      address: form.address.trim(),
      description: form.description.trim(),
      realEstateObject: buildRealEstateObjectInput(form),
    });

    return this.requireAssessment(response.assessment);
  }

  async updateDraft(
    assessmentId: string,
    form: EstimationFormDraftData,
  ): Promise<AssessmentDraftModel> {
    const response = await this.client.updateAssessment({
      id: assessmentId,
      address: form.address.trim(),
      description: form.description.trim(),
      realEstateObject: buildRealEstateObjectInput(form),
    });

    return this.requireAssessment(response.assessment);
  }

  async listCities(): Promise<LookupOption[]> {
    const response = await this.client.listCities({});
    return response.cities.map((city) => ({
      id: city.id,
      name: city.name,
    }));
  }

  async listDistricts(cityId?: string): Promise<DistrictLookupOption[]> {
    const response = await this.client.listDistricts({
      ...(cityId?.trim() && { cityId: cityId.trim() }),
    });

    return response.districts.map((district) => ({
      id: district.id,
      name: district.name,
      cityId: district.cityId,
    }));
  }

  private requireAssessment(assessment: Assessment | undefined): AssessmentDraftModel {
    if (!assessment) {
      throw new Error('Backend did not return assessment data');
    }

    return this.toAssessmentDraftModel(assessment);
  }

  private toAssessmentDraftModel(assessment: Assessment): AssessmentDraftModel {
    const realEstateObject = assessment.realEstateObject;

    return {
      id: assessment.id,
      status: assessment.status,
      updatedAt: assessment.updatedAt ? timestampDate(assessment.updatedAt).toISOString() : null,
      form: {
        cityId: realEstateObject?.cityId ?? '',
        districtId: realEstateObject?.districtId ?? '',
        address: realEstateObject?.address ?? assessment.address,
        cadastralNumber: realEstateObject?.cadastralNumber ?? '',
        area: realEstateObject?.area ?? '',
        objectType: toSelectValue(realEstateObject?.objectType),
        rooms: toNumberValue(realEstateObject?.roomsCount),
        floorsTotal: toNumberValue(realEstateObject?.floorsTotal),
        floor: toNumberValue(realEstateObject?.floor),
        condition: toSelectValue(realEstateObject?.condition),
        yearBuilt: toNumberValue(realEstateObject?.yearBuilt),
        wallMaterial: toSelectValue(realEstateObject?.wallMaterial),
        elevatorType: toSelectValue(realEstateObject?.elevatorType),
        hasBalconyOrLoggia: realEstateObject?.hasBalconyOrLoggia ?? false,
        landCategory: realEstateObject?.landCategory ?? '',
        permittedUse: realEstateObject?.permittedUse ?? '',
        utilities: realEstateObject?.utilities ?? '',
        description: resolveDescription(assessment, realEstateObject),
      },
    };
  }
}

function buildRealEstateObjectInput(form: EstimationFormDraftData) {
  return {
    cityId: form.cityId.trim(),
    districtId: normalizeOptionalString(form.districtId),
    address: form.address.trim(),
    cadastralNumber: normalizeNullableString(form.cadastralNumber),
    area: form.area.trim(),
    objectType: Number(form.objectType),
    roomsCount: normalizeOptionalInteger(form.rooms),
    floorsTotal: normalizeOptionalInteger(form.floorsTotal),
    floor: normalizeOptionalInteger(form.floor),
    condition: normalizeOptionalEnum(form.condition),
    yearBuilt: normalizeOptionalInteger(form.yearBuilt),
    wallMaterial: normalizeOptionalEnum(form.wallMaterial),
    elevatorType: normalizeOptionalEnum(form.elevatorType),
    hasBalconyOrLoggia: form.hasBalconyOrLoggia,
    landCategory: normalizeNullableString(form.landCategory),
    permittedUse: normalizeNullableString(form.permittedUse),
    utilities: normalizeNullableString(form.utilities),
    description: normalizeNullableString(form.description),
  };
}

function resolveDescription(
  assessment: Assessment,
  realEstateObject: RealEstateObject | undefined,
): string {
  return realEstateObject?.description?.trim() || assessment.description?.trim() || '';
}

function normalizeOptionalString(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeNullableString(value: string): string {
  return value.trim();
}

function normalizeOptionalInteger(value: string): number | undefined {
  const normalized = value.trim();
  return normalized ? Number(normalized) : undefined;
}

function normalizeOptionalEnum(value: string): number | undefined {
  const normalized = value.trim();
  return normalized ? Number(normalized) : undefined;
}

function toNumberValue(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function toSelectValue(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}
