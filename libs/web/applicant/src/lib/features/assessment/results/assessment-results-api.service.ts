import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  AssessmentService,
  AssessmentStatus,
  RealEstateObjectType,
  type Assessment,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT } from '@notary-portal/ui';

export interface AssessmentResultItem {
  id: string;
  address: string;
  propertyType: string;
  estimatedValue: number | null;
  assessedAt: string | null;
}

export interface AssessmentResultDetail {
  id: string;
  address: string;
  propertyType: string;
  area: string | null;
  estimatedValue: number | null;
  assessedAt: string | null;
  status: AssessmentStatus;
}

const OBJECT_TYPE_LABELS: Record<RealEstateObjectType, string> = {
  [RealEstateObjectType.UNSPECIFIED]: 'Не указан',
  [RealEstateObjectType.APARTMENT]: 'Квартира',
  [RealEstateObjectType.HOUSE]: 'Жилой дом',
  [RealEstateObjectType.ROOM]: 'Комната',
  [RealEstateObjectType.APARTMENTS]: 'Апартаменты',
  [RealEstateObjectType.LAND_PLOT]: 'Земельный участок',
  [RealEstateObjectType.COMMERCIAL_PROPERTY]: 'Нежилое помещение',
  [RealEstateObjectType.OTHER]: 'Другое',
};

@Injectable({ providedIn: 'root' })
export class AssessmentResultsApiService {
  private readonly client = createClient(AssessmentService, inject(RPC_TRANSPORT));

  async listCompletedAssessments(userId: string): Promise<AssessmentResultItem[]> {
    const response = await this.client.listAssessments({
      userId,
      statusFilter: AssessmentStatus.COMPLETED,
      pagination: { page: 1, limit: 100 },
    });

    return response.assessments.map(toAssessmentResultItem);
  }

  async getAssessmentResult(assessmentId: string): Promise<AssessmentResultDetail> {
    const response = await this.client.getAssessment({ id: assessmentId });
    if (!response.assessment) {
      throw new Error('Заявка не найдена');
    }

    return toAssessmentResultDetail(response.assessment);
  }
}

function toAssessmentResultItem(assessment: Assessment): AssessmentResultItem {
  return {
    id: assessment.id,
    address: resolveAddress(assessment),
    propertyType: resolvePropertyType(assessment),
    estimatedValue: parseEstimatedValue(assessment.estimatedValue),
    assessedAt: toIsoDate(assessment.updatedAt),
  };
}

function toAssessmentResultDetail(assessment: Assessment): AssessmentResultDetail {
  return {
    id: assessment.id,
    address: resolveAddress(assessment),
    propertyType: resolvePropertyType(assessment),
    area: assessment.realEstateObject?.area?.trim() || null,
    estimatedValue: parseEstimatedValue(assessment.estimatedValue),
    assessedAt: toIsoDate(assessment.updatedAt),
    status: assessment.status,
  };
}

function resolveAddress(assessment: Assessment): string {
  return assessment.realEstateObject?.address?.trim() || assessment.address?.trim() || 'Адрес не указан';
}

function resolvePropertyType(assessment: Assessment): string {
  const objectType = assessment.realEstateObject?.objectType ?? RealEstateObjectType.UNSPECIFIED;
  return OBJECT_TYPE_LABELS[objectType] ?? 'Не указан';
}

function parseEstimatedValue(value: string | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(timestamp: Assessment['updatedAt']): string | null {
  return timestamp ? timestampDate(timestamp).toISOString() : null;
}
