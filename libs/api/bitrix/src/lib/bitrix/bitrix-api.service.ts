import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
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
    try {
      const url = await this.getApiUrl('crm.contact.list');
      const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
        select: ['ID'],
        start: 0,
      });

      if (response.data.error) {
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
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
      };
    }
  }

  async findContactByPhone(phone: string): Promise<string | null> {
    try {
      const url = await this.getApiUrl('crm.duplicate.findByComm');
      const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
        type: 'PHONE',
        values: [phone],
      });

      if (response.data.error) {
        return null;
      }

      const contactIds = response.data.result?.CONTACT;
      if (contactIds && contactIds.length > 0) {
        return contactIds[0];
      }

      return null;
    } catch (error) {
      console.error('Error finding contact by phone:', error);
      return null;
    }
  }

  async findContactByEmail(email: string): Promise<string | null> {
    try {
      const url = await this.getApiUrl('crm.duplicate.findByComm');
      const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
        type: 'EMAIL',
        values: [email],
      });

      if (response.data.error) {
        return null;
      }

      const contactIds = response.data.result?.CONTACT;
      if (contactIds && contactIds.length > 0) {
        return contactIds[0];
      }

      return null;
    } catch (error) {
      console.error('Error finding contact by email:', error);
      return null;
    }
  }

  async createContact(contact: BitrixContact): Promise<string> {
    const url = await this.getApiUrl('crm.contact.add');
    const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
      fields: contact,
    });

    if (response.data.error) {
      throw new Error(`Failed to create contact: ${response.data.error_description || response.data.error}`);
    }

    return response.data.result;
  }

  async updateContact(contactId: string, contact: Partial<BitrixContact>): Promise<boolean> {
    const url = await this.getApiUrl('crm.contact.update');
    const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
      id: contactId,
      fields: contact,
    });

    if (response.data.error) {
      throw new Error(`Failed to update contact: ${response.data.error_description || response.data.error}`);
    }

    return true;
  }

  async getContact(contactId: string): Promise<BitrixContact | null> {
    const url = await this.getApiUrl('crm.contact.get');
    const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
      id: contactId,
    });

    if (response.data.error) {
      return null;
    }

    return response.data.result;
  }

  async searchContactsByInn(inn: string): Promise<string | null> {
    const url = await this.getApiUrl('crm.contact.list');
    const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
      filter: { UF_CRM_INN: inn },
      select: ['ID'],
      start: 0,
    });

    if (response.data.error || !response.data.result || response.data.result.length === 0) {
      return null;
    }

    return response.data.result[0].ID;
  }

  async createDeal(dealData: any): Promise<string> {
    const url = await this.getApiUrl('crm.deal.add');
    const response = await this.axiosInstance.post<BitrixApiResponse>(url, {
      fields: dealData,
    });

    if (response.data.error) {
      throw new Error(`Failed to create deal: ${response.data.error_description || response.data.error}`);
    }

    return response.data.result;
  }

  async linkContactToDeal(dealId: string, contactId: string): Promise<boolean> {
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
      throw new Error(`Failed to link contact to deal: ${response.data.error_description || response.data.error}`);
    }

    return true;
  }
}
