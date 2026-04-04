import {
  ElevatorType,
  RealEstateCondition,
  RealEstateObjectType,
  type AssessmentStatus,
  WallMaterial,
} from '@notary-portal/api-contracts';

export interface SelectOption {
  value: string;
  label: string;
}

export interface LookupOption {
  id: string;
  name: string;
}

export interface DistrictLookupOption extends LookupOption {
  cityId: string;
}

export interface EstimationFormDraftData {
  cityId: string;
  districtId: string;
  address: string;
  cadastralNumber: string;
  area: string;
  objectType: string;
  rooms: string;
  floorsTotal: string;
  floor: string;
  condition: string;
  yearBuilt: string;
  wallMaterial: string;
  elevatorType: string;
  hasBalconyOrLoggia: boolean;
  landCategory: string;
  permittedUse: string;
  utilities: string;
  description: string;
}

export interface EstimationFormValue extends EstimationFormDraftData {
  confirmCorrect: boolean;
  confirmProcessing: boolean;
}

export interface AssessmentDraftModel {
  id: string;
  status: AssessmentStatus;
  updatedAt: string | null;
  form: EstimationFormDraftData;
}

export interface AssessmentDocumentModel {
  id: string;
  fileName: string;
  fileType: string;
  filePath: string;
  previewUrl: string;
  downloadUrl: string;
  version: number;
  uploadedAt: string | null;
  kind: 'document' | 'photo' | 'additional';
}

export const INITIAL_ESTIMATION_FORM_VALUE: EstimationFormValue = {
  cityId: '',
  districtId: '',
  address: '',
  cadastralNumber: '',
  area: '',
  objectType: '',
  rooms: '',
  floorsTotal: '',
  floor: '',
  condition: '',
  yearBuilt: '',
  wallMaterial: '',
  elevatorType: '',
  hasBalconyOrLoggia: false,
  landCategory: '',
  permittedUse: '',
  utilities: '',
  description: '',
  confirmCorrect: false,
  confirmProcessing: false,
};

export const OBJECT_TYPE_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: String(RealEstateObjectType.APARTMENT), label: 'Квартира' },
  { value: String(RealEstateObjectType.HOUSE), label: 'Дом' },
  { value: String(RealEstateObjectType.ROOM), label: 'Комната' },
  { value: String(RealEstateObjectType.APARTMENTS), label: 'Апартаменты' },
  { value: String(RealEstateObjectType.LAND_PLOT), label: 'Земельный участок' },
  {
    value: String(RealEstateObjectType.COMMERCIAL_PROPERTY),
    label: 'Коммерческая недвижимость',
  },
  { value: String(RealEstateObjectType.OTHER), label: 'Другое' },
];

export const CONDITION_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: String(RealEstateCondition.EXCELLENT), label: 'Отличное' },
  { value: String(RealEstateCondition.GOOD), label: 'Хорошее' },
  { value: String(RealEstateCondition.SATISFACTORY), label: 'Удовлетворительное' },
  { value: String(RealEstateCondition.POOR), label: 'Плохое' },
];

export const WALL_MATERIAL_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: '', label: 'Не выбрано' },
  { value: String(WallMaterial.BRICK), label: 'Кирпичный' },
  { value: String(WallMaterial.PANEL), label: 'Панельный' },
  { value: String(WallMaterial.BLOCK), label: 'Блочный' },
  { value: String(WallMaterial.MONOLITHIC), label: 'Монолитный' },
  { value: String(WallMaterial.MONOLITHIC_BRICK), label: 'Монолитно-кирпичный' },
  { value: String(WallMaterial.WOODEN), label: 'Деревянный' },
  { value: String(WallMaterial.AERATED_CONCRETE), label: 'Газобетонный' },
];

export const ELEVATOR_TYPE_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: '', label: 'Не выбрано' },
  { value: String(ElevatorType.NONE), label: 'Нет' },
  { value: String(ElevatorType.CARGO), label: 'Грузовой' },
  { value: String(ElevatorType.PASSENGER), label: 'Пассажирский' },
  { value: String(ElevatorType.PASSENGER_AND_CARGO), label: 'Пассажирский и грузовой' },
];
