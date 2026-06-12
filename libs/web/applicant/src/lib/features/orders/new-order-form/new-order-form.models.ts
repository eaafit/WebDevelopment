import { DocumentType, RealEstateObjectType } from '@notary-portal/api-contracts';

export type OrderFormStep = 1 | 2 | 3 | 4;

export interface SelectOption {
  value: string;
  label: string;
}

export interface NewOrderInheritanceData {
  deceasedFullName: string;
  deathDate: string;
  notary: string;
  inheritanceCaseNumber: string;
}

export interface NewOrderPropertyData {
  propertyType: string;
  cityId: string;
  districtId: string;
  address: string;
  area: string;
  cadastralNumber: string;
  description: string;
}

export interface NewOrderDocumentRow {
  documentType: string;
  fileName: string;
}

export interface NewOrderConfirmData {
  dataAccuracyConfirmed: boolean;
  personalDataConsent: boolean;
}

export interface NewOrderFormValues {
  inheritance: NewOrderInheritanceData;
  property: NewOrderPropertyData;
  documents: NewOrderDocumentRow[];
  confirm: NewOrderConfirmData;
}

export const ORDER_PROPERTY_TYPE_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: String(RealEstateObjectType.APARTMENT), label: 'Квартира' },
  { value: String(RealEstateObjectType.HOUSE), label: 'Дом' },
  { value: String(RealEstateObjectType.LAND_PLOT), label: 'Земельный участок' },
  { value: String(RealEstateObjectType.COMMERCIAL_PROPERTY), label: 'Гараж' },
  { value: String(RealEstateObjectType.OTHER), label: 'Иное' },
];

export const DOCUMENT_TYPE_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: String(DocumentType.PASSPORT), label: 'Паспорт' },
  { value: String(DocumentType.PROPERTY_DEED), label: 'Правоустанавливающий документ' },
  { value: String(DocumentType.TECHNICAL_PLAN), label: 'Технический план' },
  { value: String(DocumentType.CADASTRAL_PASSPORT), label: 'Кадастровый паспорт' },
  { value: String(DocumentType.PHOTO), label: 'Фото объекта' },
  { value: String(DocumentType.OTHER), label: 'Иное' },
];

export const ORDER_FORM_STEPS: ReadonlyArray<{ step: OrderFormStep; label: string }> = [
  { step: 1, label: 'Данные о наследстве' },
  { step: 2, label: 'Параметры объекта' },
  { step: 3, label: 'Документы' },
  { step: 4, label: 'Подтверждение' },
];

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'] as const;
export const SESSION_STORAGE_KEY = 'applicant-new-order-form-draft';

export const INITIAL_INHERITANCE_VALUE: NewOrderInheritanceData = {
  deceasedFullName: '',
  deathDate: '',
  notary: '',
  inheritanceCaseNumber: '',
};

export const INITIAL_PROPERTY_VALUE: NewOrderPropertyData = {
  propertyType: '',
  cityId: '',
  districtId: '',
  address: '',
  area: '',
  cadastralNumber: '',
  description: '',
};

export const INITIAL_CONFIRM_VALUE: NewOrderConfirmData = {
  dataAccuracyConfirmed: false,
  personalDataConsent: false,
};
