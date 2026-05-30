// Поля лида согласно Bitrix REST crm.lead.add
// https://apidocs.bitrix24.ru/api-reference/crm/leads/crm-lead-add.html
export interface LeadFields {
  TITLE?: string;
  NAME?: string;
  LAST_NAME?: string;
  SECOND_NAME?: string;
  PHONE?: LeadMultiField[];
  EMAIL?: LeadMultiField[];
  ADDRESS?: string;
  ADDRESS_CITY?: string;
  COMMENTS?: string;
  SOURCE_ID?: string;
  STATUS_ID?: string;
  OPPORTUNITY?: number;
  CURRENCY_ID?: string;
  ASSIGNED_BY_ID?: number;
  UF_CRM_ASSESSMENT_ID?: string;
}

export interface LeadMultiField {
  VALUE: string;
  VALUE_TYPE?: 'WORK' | 'HOME' | 'MOBILE' | 'OTHER';
}

export interface BitrixSuccessResponse<T> {
  result: T;
  time?: {
    start: number;
    finish: number;
    duration: number;
    processing: number;
  };
}

export interface BitrixErrorResponse {
  error: string;
  error_description?: string;
}

export type BitrixResponse<T> = BitrixSuccessResponse<T> | BitrixErrorResponse;

export type LeadCreateResult = number;
