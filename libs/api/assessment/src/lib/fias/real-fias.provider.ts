import { Code, ConnectError } from '@connectrpc/connect';
import type {
  FiasAddressDetails,
  FiasAddressHint,
  FiasAddressItem,
} from '@notary-portal/api-contracts';
import type {
  FiasAddressHintRequest,
  FiasProvider,
  FiasSearchAddressItemsRequest,
  FiasSearchByPartsRequest,
} from './fias-provider';

export interface RealFiasProviderOptions {
  baseUrl?: string;
  masterToken?: string;
}

export class RealFiasProvider implements FiasProvider {
  private readonly baseUrl: string;
  private readonly masterToken: string;

  constructor(options: RealFiasProviderOptions = {}) {
    this.baseUrl =
      options.baseUrl?.replace(/\/$/, '') ??
      'https://fias-public-service.nalog.ru/api/spas/v2.0';
    this.masterToken = options.masterToken?.trim() ?? '';
  }

  async getAddressHint(request: FiasAddressHintRequest): Promise<FiasAddressHint[]> {
    void request;
    this.throwRealProviderDisabled('GetAddressHint');
  }

  async searchAddressItems(request: FiasSearchAddressItemsRequest): Promise<FiasAddressItem[]> {
    void request;
    this.throwRealProviderDisabled('SearchAddressItems');
  }

  async getAddressItemById(objectId: string): Promise<FiasAddressItem> {
    void objectId;
    this.throwRealProviderDisabled('GetAddressItemById');
  }

  async getAddressItemByGuid(objectGuid: string): Promise<FiasAddressItem> {
    void objectGuid;
    this.throwRealProviderDisabled('GetAddressItemByGuid');
  }

  async getDetails(objectId: string): Promise<FiasAddressDetails> {
    void objectId;
    this.throwRealProviderDisabled('GetDetails');
  }

  async searchByParts(request: FiasSearchByPartsRequest): Promise<FiasAddressItem[]> {
    void request;
    this.throwRealProviderDisabled('SearchByParts');
  }

  private throwRealProviderDisabled(methodName: string): never {
    const tokenHint = this.masterToken
      ? 'HTTP adapter is not enabled yet'
      : 'FIAS_MASTER_TOKEN is not configured';
    throw new ConnectError(
      `Real FIAS provider is prepared for ${this.baseUrl}/${methodName}, but ${tokenHint}`,
      Code.Unavailable,
    );
  }
}

