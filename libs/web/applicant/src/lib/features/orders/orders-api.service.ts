import { Injectable, inject } from '@angular/core';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import {
  AssessmentService,
  AssessmentStatus,
  RealEstateObjectType,
  type Assessment,
} from '@notary-portal/api-contracts';
import { createClient } from '@connectrpc/connect';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { ORDER_PROPERTY_TYPE_OPTIONS } from './new-order-form/new-order-form.models';

export interface ApplicantOrderView {
  id: string;
  address: string;
  addressHint: string;
  propertyType: string;
  area: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ApplicantOrdersApiService {
  private readonly client = createClient(AssessmentService, inject(RPC_TRANSPORT));

  async listUserOrders(userId: string): Promise<ApplicantOrderView[]> {
    const response = await this.client.listAssessments({
      userId,
      statusFilter: AssessmentStatus.UNSPECIFIED,
      pagination: {
        page: 1,
        limit: 100,
      },
    });

    return response.assessments.map((assessment) => this.toOrderView(assessment));
  }

  private toOrderView(assessment: Assessment): ApplicantOrderView {
    const realEstateObject = assessment.realEstateObject;
    const address = realEstateObject?.address?.trim() || assessment.address?.trim() || '—';
    const areaValue = Number(realEstateObject?.area ?? 0);
    const objectType = realEstateObject?.objectType ?? RealEstateObjectType.UNSPECIFIED;

    return {
      id: assessment.id,
      address,
      addressHint: this.buildAddressHint(realEstateObject?.cadastralNumber),
      propertyType: this.getPropertyTypeLabel(objectType),
      area: Number.isFinite(areaValue) ? areaValue : 0,
      status: mapAssessmentStatus(assessment.status),
      createdAt: formatDate(assessment.createdAt),
      updatedAt: formatDate(assessment.updatedAt),
    };
  }

  private buildAddressHint(cadastralNumber: string | undefined): string {
    const normalized = cadastralNumber?.trim() ?? '';
    return normalized ? `Кадастровый № ${normalized}` : '';
  }

  private getPropertyTypeLabel(objectType: RealEstateObjectType): string {
    return (
      ORDER_PROPERTY_TYPE_OPTIONS.find((option) => option.value === String(objectType))?.label ??
      'Не указан'
    );
  }
}

function mapAssessmentStatus(status: AssessmentStatus): string {
  switch (status) {
    case AssessmentStatus.NEW:
      return 'new';
    case AssessmentStatus.VERIFIED:
    case AssessmentStatus.IN_PROGRESS:
      return 'progress';
    case AssessmentStatus.COMPLETED:
      return 'completed';
    case AssessmentStatus.CANCELLED:
      return 'rejected';
    default:
      return 'new';
  }
}

function formatDate(timestamp: Assessment['createdAt']): string {
  if (!timestamp) {
    return '—';
  }

  return timestampDate(timestamp).toLocaleDateString('ru-RU');
}
