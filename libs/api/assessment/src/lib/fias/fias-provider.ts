import type {
  FiasAddressDetails,
  FiasAddressHint,
  FiasAddressItem,
} from '@notary-portal/api-contracts';

export const FIAS_PROVIDER = Symbol('FIAS_PROVIDER');

export interface FiasAddressHintRequest {
  query: string;
  limit?: number;
  addressType?: number;
}

export interface FiasSearchAddressItemsRequest {
  query: string;
  limit?: number;
  addressType?: number;
}

export interface FiasSearchByPartsRequest {
  region?: string;
  city?: string;
  street?: string;
  house?: string;
  limit?: number;
  addressType?: number;
}

export interface FiasProvider {
  getAddressHint(request: FiasAddressHintRequest): Promise<FiasAddressHint[]>;
  searchAddressItems(request: FiasSearchAddressItemsRequest): Promise<FiasAddressItem[]>;
  getAddressItemById(objectId: string): Promise<FiasAddressItem>;
  getAddressItemByGuid(objectGuid: string): Promise<FiasAddressItem>;
  getDetails(objectId: string): Promise<FiasAddressDetails>;
  searchByParts(request: FiasSearchByPartsRequest): Promise<FiasAddressItem[]>;
}

