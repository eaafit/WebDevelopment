import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  BusinessOperations,
  NotarySpanAttributes,
  SpanKind,
  markSpanFailure,
  runInSpan,
} from '@internal/tracing';
import { BitrixConfigService } from './bitrix-config.service';

interface BitrixContact {
  ID?: string;
  NAME: string;
  LAST_NAME: string;
  SECOND_NAME?: string;
  PHONE?: Array<{ VALUE: string; VALUE_TYPE: string }>;
  EMAIL?: Array<{ VALUE: string; VALUE_TYPE: string }>;
  TYPE_ID?: 'PERSON' | 'COMPANY';
  SOURCE_ID?: string;
  UF_CRM_INN?: string;
  UF_CRM_PASSPORT?: string;
  UF_CRM_NOTARY_ID?: string;
}

interface BitrixApiResponse {
  result?: any;
  error?: string;
  error_description?: string;
}

@Injectable()
export class BitrixApiService {
  private readonly logger = new Logger(BitrixApiService.name);
  private axiosInstance: AxiosInstance;

  constructor(private readonly configService: BitrixConfigService) {
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async getApiUrl(method: string): Promise<string> {
    const config = await this.configService.getActiveConfig();
    if (!config) {
      throw new Error('Bitrix configuration is not set or inactive');
    }

    return `https://${config.portalUrl}/rest/${config.memberId}/${config.accessToken}/${method}`;
  }

  async testConnection(): Promise<{ success: boolean; message: string; testedAt: Date }> {
    return runInSpan(
      'BitrixApiService.testConnection',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixConnectionTestExternal,
        [NotarySpanAttributes.entity]: 'BitrixContact',
        'bitrix.method': 'crm.contact.list',
      },
      async (span) => {
        try {
          const url = await this.getApiUrl('crm.contact.list');
          const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
            select: ['ID'],
            start: 0,
          });

          if (response.data.error) {
            markSpanFailure(span, new Error('BitrixApiError'));
            return {
              success: false,
              message: `Bitrix API error: ${response.data.error_description || response.data.error}`,
              testedAt: new Date(),
            };
          }

          return {
            success: true,
            message: 'Connection successful',
            testedAt: new Date(),
          };
        } catch (error) {
          markSpanFailure(span, error);
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            testedAt: new Date(),
          };
        }
      },
      { kind: SpanKind.CLIENT },
    );
  }

  async findContactByPhone(phone: string): Promise<string | null> {
    return runInSpan(
      'BitrixApiService.findContactByPhone',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixContactFind,
        [NotarySpanAttributes.entity]: 'BitrixContact',
        'bitrix.method': 'crm.duplicate.findByComm',
        'bitrix.contact.has_phone': Boolean(phone),
      },
      async (span) => {
        try {
          const url = await this.getApiUrl('crm.duplicate.findByComm');
          const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
            type: 'PHONE',
            values: [phone],
          });

          if (response.data.error) {
            markSpanFailure(span, new Error('BitrixApiError'));
            return null;
          }

          const contactIds = response.data.result?.CONTACT;
          if (contactIds && contactIds.length > 0) {
            return contactIds[0];
          }

          return null;
        } catch (error) {
          markSpanFailure(span, error);
          this.logger.warn(
            `Bitrix contact lookup failed; operation=find_contact_by_phone; result=error; error=${safeErrorName(error)}`,
          );
          return null;
        }
      },
      { kind: SpanKind.CLIENT },
    );
  }

  async findContactByEmail(email: string): Promise<string | null> {
    return runInSpan(
      'BitrixApiService.findContactByEmail',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixContactFind,
        [NotarySpanAttributes.entity]: 'BitrixContact',
        'bitrix.method': 'crm.duplicate.findByComm',
        'bitrix.contact.has_email': Boolean(email),
      },
      async (span) => {
        try {
          const url = await this.getApiUrl('crm.duplicate.findByComm');
          const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
            type: 'EMAIL',
            values: [email],
          });

          if (response.data.error) {
            markSpanFailure(span, new Error('BitrixApiError'));
            return null;
          }

          const contactIds = response.data.result?.CONTACT;
          if (contactIds && contactIds.length > 0) {
            return contactIds[0];
          }

          return null;
        } catch (error) {
          markSpanFailure(span, error);
          this.logger.warn(
            `Bitrix contact lookup failed; operation=find_contact_by_email; result=error; error=${safeErrorName(error)}`,
          );
          return null;
        }
      },
      { kind: SpanKind.CLIENT },
    );
  }

  async createContact(contact: BitrixContact): Promise<string> {
    return runInSpan(
      'BitrixApiService.createContact',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixContactCreate,
        [NotarySpanAttributes.entity]: 'BitrixContact',
        'bitrix.method': 'crm.contact.add',
        'bitrix.contact.has_phone': Boolean(contact.PHONE?.length),
        'bitrix.contact.has_email': Boolean(contact.EMAIL?.length),
      },
      async () => {
        const url = await this.getApiUrl('crm.contact.add');
        const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
          fields: contact,
        });

        if (response.data.error) {
          throw new Error(
            `Failed to create contact: ${response.data.error_description || response.data.error}`,
          );
        }

        return response.data.result;
      },
      { kind: SpanKind.CLIENT },
    );
  }

  async updateContact(contactId: string, contact: Partial<BitrixContact>): Promise<boolean> {
    return runInSpan(
      'BitrixApiService.updateContact',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixContactUpdate,
        [NotarySpanAttributes.entity]: 'BitrixContact',
        'bitrix.method': 'crm.contact.update',
        'bitrix.contact.has_phone': Boolean(contact.PHONE?.length),
        'bitrix.contact.has_email': Boolean(contact.EMAIL?.length),
      },
      async () => {
        const url = await this.getApiUrl('crm.contact.update');
        const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
          id: contactId,
          fields: contact,
        });

        if (response.data.error) {
          throw new Error(
            `Failed to update contact: ${response.data.error_description || response.data.error}`,
          );
        }

        return true;
      },
      { kind: SpanKind.CLIENT },
    );
  }

  async getContact(contactId: string): Promise<BitrixContact | null> {
    return runInSpan(
      'BitrixApiService.getContact',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixContactGet,
        [NotarySpanAttributes.entity]: 'BitrixContact',
        'bitrix.method': 'crm.contact.get',
      },
      async (span) => {
        const url = await this.getApiUrl('crm.contact.get');
        const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
          id: contactId,
        });

        if (response.data.error) {
          markSpanFailure(span, new Error('BitrixApiError'));
          return null;
        }

        return response.data.result;
      },
      { kind: SpanKind.CLIENT },
    );
  }

  async searchContactsByInn(inn: string): Promise<string | null> {
    return runInSpan(
      'BitrixApiService.searchContactsByInn',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixContactFind,
        [NotarySpanAttributes.entity]: 'BitrixContact',
        'bitrix.method': 'crm.contact.list',
        'bitrix.contact.has_inn': Boolean(inn),
      },
      async (span) => {
        const url = await this.getApiUrl('crm.contact.list');
        const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
          filter: { UF_CRM_INN: inn },
          select: ['ID'],
          start: 0,
        });

        if (response.data.error) {
          markSpanFailure(span, new Error('BitrixApiError'));
          return null;
        }

        if (!response.data.result || response.data.result.length === 0) {
          return null;
        }

        return response.data.result[0].ID;
      },
      { kind: SpanKind.CLIENT },
    );
  }

  async createDeal(dealData: any): Promise<string> {
    return runInSpan(
      'BitrixApiService.createDeal',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixDealCreate,
        [NotarySpanAttributes.entity]: 'BitrixDeal',
        'bitrix.method': 'crm.deal.add',
      },
      async () => {
        const url = await this.getApiUrl('crm.deal.add');
        const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
          fields: dealData,
        });

        if (response.data.error) {
          throw new Error(
            `Failed to create deal: ${response.data.error_description || response.data.error}`,
          );
        }

        return response.data.result;
      },
      { kind: SpanKind.CLIENT },
    );
  }

  async linkContactToDeal(dealId: string, contactId: string): Promise<boolean> {
    return runInSpan(
      'BitrixApiService.linkContactToDeal',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixDealLinkContact,
        [NotarySpanAttributes.entity]: 'BitrixDeal',
        'bitrix.method': 'crm.deal.contact.items.set',
      },
      async () => {
        const url = await this.getApiUrl('crm.deal.contact.items.set');
        const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
          id: dealId,
          items: [
            {
              CONTACT_ID: contactId,
              IS_PRIMARY: 'Y',
              SORT: 10,
            },
          ],
        });

        if (response.data.error) {
          throw new Error(
            `Failed to link contact to deal: ${response.data.error_description || response.data.error}`,
          );
        }

        return true;
      },
      { kind: SpanKind.CLIENT },
    );
  }
}

function safeErrorName(error: unknown): string {
  return error instanceof Error && error.name.trim() ? error.name : 'UnknownError';
}
