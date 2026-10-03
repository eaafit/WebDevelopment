import { Injectable, inject } from '@angular/core';
import { createClient } from '@connectrpc/connect';
import {
  AssessmentService,
  DocumentService,
  type Assessment,
  type DocumentType,
} from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { AssessmentApiService } from '../../estimation-form/assessment-api.service';
import type { NewOrderFormValues, NewOrderPropertyData } from './new-order-form.models';
import { normalizeFormText } from './new-order-form.utils';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable({ providedIn: 'root' })
export class NewOrderFormApiService {
  private readonly assessmentClient = createClient(AssessmentService, inject(RPC_TRANSPORT));
  private readonly documentClient = createClient(DocumentService, inject(RPC_TRANSPORT));
  private readonly assessmentApi = inject(AssessmentApiService);

  async resolvePropertyGeography(property: NewOrderPropertyData): Promise<NewOrderPropertyData> {
    const cityId = normalizeFormText(property.cityId);
    if (isValidUuid(cityId)) {
      return property;
    }

    const address = normalizeFormText(property.address);
    if (!address) {
      throw new Error('Укажите адрес объекта.');
    }

    const hints = await this.assessmentApi.getFiasAddressHints(address);
    if (!hints.length) {
      throw new Error('Выберите адрес из подсказок ФИАС на первом шаге формы.');
    }

    const normalizedAddress = normalizeAddressMatchKey(address);
    const matchedHint =
      hints.find((hint) => normalizeAddressMatchKey(hint.fullName) === normalizedAddress) ??
      hints[0];
    const selectedAddress = await this.assessmentApi.getFiasAddressItemById(matchedHint.objectId);
    const resolvedCityId = normalizeFormText(selectedAddress.cityId);

    if (!isValidUuid(resolvedCityId)) {
      throw new Error('Не удалось определить город для выбранного адреса. Выберите адрес из ФИАС.');
    }

    return {
      ...property,
      cityId: resolvedCityId,
      districtId: normalizeFormText(selectedAddress.districtId),
      address: normalizeFormText(selectedAddress.fullName) || address,
      cadastralNumber:
        normalizeFormText(property.cadastralNumber) ||
        normalizeFormText(selectedAddress.cadastralNumber),
    };
  }

  async createAssessment(userId: string, form: NewOrderFormValues): Promise<Assessment> {
    const property = await this.resolvePropertyGeography(form.property);
    const inheritance = form.inheritance;
    const address = normalizeFormText(property.address);
    const description = normalizeFormText(property.description);
    const area = normalizeFormText(property.area);
    const cadastralNumber = normalizeFormText(property.cadastralNumber);
    const cityId = normalizeFormText(property.cityId);
    const districtId = normalizeFormText(property.districtId);

    // Include inheritance data in description for now (proto doesn't have dedicated fields yet)
    const notaryInfo = inheritance.notary
      ? `, Нотариус: ${normalizeFormText(inheritance.notary)}`
      : '';
    const inheritanceInfo = `Наследодатель: ${normalizeFormText(inheritance.deceasedFullName)}, Дата смерти: ${normalizeFormText(inheritance.deathDate)}, Номер дела: ${normalizeFormText(inheritance.inheritanceCaseNumber)}${notaryInfo}`;
    const fullDescription = description ? `${description}. ${inheritanceInfo}` : inheritanceInfo;

    const response = await this.assessmentClient.createAssessment({
      userId,
      address,
      description: fullDescription,
      realEstateObject: {
        cityId,
        districtId: districtId || undefined,
        address,
        area,
        cadastralNumber,
        objectType: Number(property.propertyType),
        description: fullDescription,
        roomsCount: property.rooms ? Number(property.rooms) : undefined,
        floorsTotal: property.buildingFloors ? Number(property.buildingFloors) : undefined,
        floor: property.floor ? Number(property.floor) : undefined,
        condition: property.condition ? this.mapConditionToNumber(property.condition) : undefined,
        yearBuilt: property.constructionYear ? Number(property.constructionYear) : undefined,
        wallMaterial: property.houseType
          ? this.mapWallMaterialToNumber(property.houseType)
          : undefined,
        elevatorType: property.elevator
          ? this.mapElevatorTypeToNumber(property.elevator)
          : undefined,
        hasBalconyOrLoggia: property.hasBalcony,
      },
    });

    if (!response.assessment) {
      throw new Error('Сервер не вернул данные созданной заявки.');
    }

    return response.assessment;
  }

  async updateAssessment(assessmentId: string, form: NewOrderFormValues): Promise<Assessment> {
    const property = await this.resolvePropertyGeography(form.property);
    const inheritance = form.inheritance;
    const address = normalizeFormText(property.address);
    const description = normalizeFormText(property.description);
    const area = normalizeFormText(property.area);
    const cadastralNumber = normalizeFormText(property.cadastralNumber);
    const cityId = normalizeFormText(property.cityId);
    const districtId = normalizeFormText(property.districtId);

    // Include inheritance data in description for now (proto doesn't have dedicated fields yet)
    const notaryInfo = inheritance.notary
      ? `, Нотариус: ${normalizeFormText(inheritance.notary)}`
      : '';
    const inheritanceInfo = `Наследодатель: ${normalizeFormText(inheritance.deceasedFullName)}, Дата смерти: ${normalizeFormText(inheritance.deathDate)}, Номер дела: ${normalizeFormText(inheritance.inheritanceCaseNumber)}${notaryInfo}`;
    const fullDescription = description ? `${description}. ${inheritanceInfo}` : inheritanceInfo;

    const response = await this.assessmentClient.updateAssessment({
      id: assessmentId,
      address,
      description: fullDescription,
      realEstateObject: {
        cityId,
        districtId: districtId || undefined,
        address,
        area,
        cadastralNumber,
        objectType: Number(property.propertyType),
        description: fullDescription,
        roomsCount: property.rooms ? Number(property.rooms) : undefined,
        floorsTotal: property.buildingFloors ? Number(property.buildingFloors) : undefined,
        floor: property.floor ? Number(property.floor) : undefined,
        condition: property.condition ? this.mapConditionToNumber(property.condition) : undefined,
        yearBuilt: property.constructionYear ? Number(property.constructionYear) : undefined,
        wallMaterial: property.houseType
          ? this.mapWallMaterialToNumber(property.houseType)
          : undefined,
        elevatorType: property.elevator
          ? this.mapElevatorTypeToNumber(property.elevator)
          : undefined,
        hasBalconyOrLoggia: property.hasBalcony,
      },
    });

    if (!response.assessment) {
      throw new Error('Сервер не вернул данные обновленной заявки.');
    }

    return response.assessment;
  }

  async createDocumentMock(params: {
    assessmentId: string;
    fileName: string;
    fileType: string;
    documentType: DocumentType;
    uploadedById: string;
    fileContent: Uint8Array;
  }): Promise<void> {
    await this.documentClient.createDocument({
      assessmentId: params.assessmentId,
      fileName: params.fileName,
      fileType: params.fileType,
      uploadedById: params.uploadedById,
      documentType: params.documentType,
      fileContent: params.fileContent,
    });
  }

  private mapConditionToNumber(condition: string): number {
    // Map string values from form to RealEstateCondition enum
    // new=0, good=1, satisfactory=2, requires_repair=3, emergency=4
    const conditionMap: Record<string, number> = {
      new: 0,
      good: 1,
      satisfactory: 2,
      requires_repair: 3,
      emergency: 4,
    };
    return conditionMap[condition] ?? 0;
  }

  private mapWallMaterialToNumber(wallMaterial: string): number {
    // Map string values from form to WallMaterial enum
    // brick=1, panel=2, block=3, monolithic=4, monolithic_brick=5, wooden=6, aerated_concrete=7
    const materialMap: Record<string, number> = {
      brick: 1,
      panel: 2,
      block: 3,
      monolithic: 4,
      monolithic_brick: 5,
      wooden: 6,
      aerated_concrete: 7,
    };
    return materialMap[wallMaterial] ?? 0;
  }

  private mapElevatorTypeToNumber(elevatorType: string): number {
    // Map string values from form to ElevatorType enum
    // none=1, freight=2, passenger=3, passenger_freight=4
    const elevatorMap: Record<string, number> = {
      none: 1,
      freight: 2,
      passenger: 3,
      passenger_freight: 4,
    };
    return elevatorMap[elevatorType] ?? 0;
  }
}

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function normalizeAddressMatchKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').replace(/[.,]/g, '').trim();
}
