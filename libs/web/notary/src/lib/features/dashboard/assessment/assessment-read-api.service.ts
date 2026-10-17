import { Injectable, inject } from '@angular/core';
import { createClient } from '@connectrpc/connect';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { AssessmentService, type Assessment as RpcAssessment } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import type { AssessmentItem, AssessmentStatus, ObjectType, RealEstateObject } from './assessment';

// API передаёт статусы и типы числами. Таблицы переводят их в понятные значения.
const statuses: Record<number, AssessmentStatus> = {
  1: 'New',
  2: 'Verified',
  3: 'InProgress',
  4: 'Completed',
  5: 'Cancelled',
};
const types: Record<number, ObjectType> = {
  1: 'Apartment',
  2: 'House',
  3: 'Room',
  4: 'Apartments',
  5: 'LandPlot',
  6: 'CommercialProperty',
  7: 'Other',
};
const conditions: Record<number, RealEstateObject['condition']> = {
  1: 'Excellent',
  2: 'Good',
  3: 'Satisfactory',
  4: 'Poor',
};
const walls: Record<number, string> = {
  1: 'Brick',
  2: 'Panel',
  3: 'Block',
  4: 'Monolithic',
  5: 'MonolithicBrick',
  6: 'Wooden',
  7: 'AeratedConcrete',
};
const elevators: Record<number, string> = {
  1: 'None',
  2: 'Cargo',
  3: 'Passenger',
  4: 'PassengerAndCargo',
};
function optionalNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
// Преобразуем ответ API в данные, с которыми работает страница.
export function mapAssessment(value: RpcAssessment): AssessmentItem {
  const object = value.realEstateObject;
  return {
    assessment: {
      id: value.id,
      status: statuses[value.status] ?? 'Unknown',
      address: value.address || object?.address || 'Адрес не указан',
      description: value.description,
      estimatedValue: optionalNumber(value.estimatedValue),
      createdAt: value.createdAt ? timestampDate(value.createdAt).toISOString() : '',
      updatedAt: value.updatedAt ? timestampDate(value.updatedAt).toISOString() : '',
    },
    realEstate: {
      id: object?.id ?? '',
      city: object?.city?.name ?? 'Не указан',
      district: object?.district?.name,
      address: object?.address || value.address,
      area: optionalNumber(object?.area),
      objectType: types[object?.objectType ?? 0] ?? 'Unknown',
      roomsCount: object?.roomsCount,
      floorsTotal: object?.floorsTotal,
      floor: object?.floor,
      condition: conditions[object?.condition ?? 0] ?? 'Unknown',
      yearBuilt: object?.yearBuilt,
      wallMaterial: walls[object?.wallMaterial ?? 0],
      elevatorType: elevators[object?.elevatorType ?? 0],
      description: object?.description,
    },
  };
}

@Injectable({ providedIn: 'root' })
export class AssessmentReadApiService {
  private readonly client = createClient(AssessmentService, inject(RPC_TRANSPORT));

  // Получение одной страницы: по 20 заявок.
  async list(page = 1): Promise<{ items: AssessmentItem[]; totalPages: number }> {
    const response = await this.client.listAssessments({ pagination: { page, limit: 20 } });
    return {
      items: response.assessments.map(mapAssessment),
      totalPages: Math.max(1, response.meta?.totalPages ?? 1),
    };
  }
  // Получение подробностей выбранной заявки.
  async get(id: string): Promise<AssessmentItem> {
    const response = await this.client.getAssessment({ id });
    if (!response.assessment) throw new Error('Сервер не вернул заявку.');
    return mapAssessment(response.assessment);
  }
}
