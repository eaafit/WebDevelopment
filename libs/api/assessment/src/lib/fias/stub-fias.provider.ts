import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  FiasAddressDetailsSchema,
  FiasAddressHintSchema,
  FiasAddressItemSchema,
  FiasAddressPathItemSchema,
  type FiasAddressDetails,
  type FiasAddressHint,
  type FiasAddressItem,
  type FiasAddressPathItem,
} from '@notary-portal/api-contracts';
import type {
  FiasAddressHintRequest,
  FiasProvider,
  FiasSearchAddressItemsRequest,
  FiasSearchByPartsRequest,
} from './fias-provider';

const MUNICIPAL_ADDRESS_TYPE = 2;
const DEFAULT_LIMIT = 5;

const CITY_IDS = {
  ekaterinburg: 'c097f53d-e513-47c4-a72b-07a304711ce3',
  moscow: 'dbbe9e82-c4ab-437c-a9e8-629ec978b64c',
  saintPetersburg: '1ae3e9ba-69df-4a5a-ad58-b072fb5a992a',
} as const;

const DISTRICT_IDS = {
  ekaterinburgLeninsky: '30448518-de64-4b0f-a080-79a4e7ac1c86',
  moscowTverskoy: '54496aa9-baa2-476b-acc3-7bc1046e614a',
  saintPetersburgCentral: 'ea0ac134-60c1-4dd5-ac05-4d51a599c3f7',
} as const;

export class StubFiasProvider implements FiasProvider {
  private readonly addressItems = buildStubAddressItems();

  async getAddressHint(request: FiasAddressHintRequest): Promise<FiasAddressHint[]> {
    return this.findItems(request.query, request.limit, request.addressType).map((item) =>
      this.toHint(item),
    );
  }

  async searchAddressItems(request: FiasSearchAddressItemsRequest): Promise<FiasAddressItem[]> {
    return this.findItems(request.query, request.limit, request.addressType);
  }

  async getAddressItemById(objectId: string): Promise<FiasAddressItem> {
    const item = this.addressItems.find((addressItem) => addressItem.objectId === objectId);
    if (!item) {
      throw new ConnectError(`FIAS address item object_id=${objectId} was not found`, Code.NotFound);
    }
    return item;
  }

  async getAddressItemByGuid(objectGuid: string): Promise<FiasAddressItem> {
    const item = this.addressItems.find((addressItem) => addressItem.objectGuid === objectGuid);
    if (!item) {
      throw new ConnectError(
        `FIAS address item object_guid=${objectGuid} was not found`,
        Code.NotFound,
      );
    }
    return item;
  }

  async getDetails(objectId: string): Promise<FiasAddressDetails> {
    return this.getAddressItemById(objectId).then((item) =>
      create(FiasAddressDetailsSchema, item.addressDetails ?? {}),
    );
  }

  async searchByParts(request: FiasSearchByPartsRequest): Promise<FiasAddressItem[]> {
    const expectedParts = [request.region, request.city, request.street, request.house]
      .flatMap((part) => toSearchTokens(part));

    if (!expectedParts.length) {
      return [];
    }

    return this.limitItems(
      this.addressItems.filter((item) => {
        const searchableText = normalizeSearchText(
          [
            item.fullName,
            item.addressDetails?.region,
            item.addressDetails?.city,
            item.addressDetails?.district,
            item.addressDetails?.street,
            item.addressDetails?.house,
            item.addressDetails?.room,
          ].join(' '),
        );
        const searchableTokens = toSearchTokens(searchableText);

        return (
          this.matchesAddressType(item, request.addressType) &&
          expectedParts.every((part) => searchableTokens.includes(part))
        );
      }),
      request.limit,
    );
  }

  private findItems(
    rawQuery: string,
    limit: number | undefined,
    addressType: number | undefined,
  ): FiasAddressItem[] {
    const query = normalizeSearchText(rawQuery);
    if (query.length < 3) {
      return [];
    }

    const queryParts = toSearchTokens(query);

    return this.limitItems(
      this.addressItems.filter((item) => {
        const searchableTokens = toSearchTokens(item.fullName);
        return (
          item.isActive &&
          this.matchesAddressType(item, addressType) &&
          queryParts.every((part) => searchableTokens.includes(part))
        );
      }),
      limit,
    );
  }

  private matchesAddressType(item: FiasAddressItem, addressType: number | undefined): boolean {
    return addressType === undefined || addressType === 0 || item.addressType === addressType;
  }

  private limitItems(items: FiasAddressItem[], limit = DEFAULT_LIMIT): FiasAddressItem[] {
    return items.slice(0, Math.max(1, Math.min(limit, 10)));
  }

  private toHint(item: FiasAddressItem): FiasAddressHint {
    return create(FiasAddressHintSchema, {
      objectId: item.objectId,
      objectGuid: item.objectGuid,
      fullName: item.fullName,
      objectLevelId: item.objectLevelId,
      addressType: item.addressType,
      path: item.path,
      isActive: item.isActive,
      cityId: item.cityId,
      districtId: item.districtId,
    });
  }
}

function buildStubAddressItems(): FiasAddressItem[] {
  return [
    buildAddressItem({
      objectId: '6600000100000000000000001',
      objectGuid: 'b1f7b1a0-8a2c-4b1b-9b7f-9d764a3a1001',
      fullName: 'Свердловская обл, г Екатеринбург, ул Малышева, д 16',
      region: 'Свердловская обл',
      city: 'Екатеринбург',
      district: 'Ленинский',
      street: 'ул Малышева',
      house: 'д 16',
      postalCode: '620014',
      cadastralNumber: '660000000001',
      cityId: CITY_IDS.ekaterinburg,
      districtId: DISTRICT_IDS.ekaterinburgLeninsky,
      path: [
        pathItem('66', '92b30014-4d52-4e2e-892d-928142b924bf', 'Свердловская', 'обл', 1),
        pathItem('6600000100000', '2763c110-cb8b-416a-9dac-ad28a55b4402', 'Екатеринбург', 'г', 5),
        pathItem('6600000100000001', 'bc500f45-28f0-4e7a-9f3d-47e48f316101', 'Малышева', 'ул', 8),
      ],
    }),
    buildAddressItem({
      objectId: '6600000100000000000000002',
      objectGuid: 'b1f7b1a0-8a2c-4b1b-9b7f-9d764a3a1002',
      houseObjectId: '6600000100000000000000102',
      fullName: 'Свердловская обл, г Екатеринбург, ул Ленина, д 10, кв 45',
      region: 'Свердловская обл',
      city: 'Екатеринбург',
      district: 'Ленинский',
      street: 'ул Ленина',
      house: 'д 10',
      room: 'кв 45',
      postalCode: '620075',
      cadastralNumber: '660000000002',
      cityId: CITY_IDS.ekaterinburg,
      districtId: DISTRICT_IDS.ekaterinburgLeninsky,
      path: [
        pathItem('66', '92b30014-4d52-4e2e-892d-928142b924bf', 'Свердловская', 'обл', 1),
        pathItem('6600000100000', '2763c110-cb8b-416a-9dac-ad28a55b4402', 'Екатеринбург', 'г', 5),
        pathItem('6600000100000002', 'd6dfb2e2-a302-478f-90bf-06a238116102', 'Ленина', 'ул', 8),
      ],
    }),
    buildAddressItem({
      objectId: '7700000000000000000000001',
      objectGuid: 'a2e0274d-5f1a-4f43-8f25-a98d82e21001',
      houseObjectId: '7700000000000000000000101',
      fullName: 'г Москва, ул Тверская, д 7, кв 12',
      region: 'Москва',
      city: 'Москва',
      district: 'Тверской',
      street: 'ул Тверская',
      house: 'д 7',
      room: 'кв 12',
      postalCode: '125009',
      cadastralNumber: '770000000001',
      cityId: CITY_IDS.moscow,
      districtId: DISTRICT_IDS.moscowTverskoy,
      path: [
        pathItem('77', '0c5b2444-70a0-4932-980c-b4dc0d3f02b5', 'Москва', 'г', 1),
        pathItem('7700000000000001', '7c2d3b91-0471-44de-9b61-bf838c5a1001', 'Тверская', 'ул', 8),
      ],
    }),
    buildAddressItem({
      objectId: '7800000000000000000000001',
      objectGuid: 'e4b9fd65-995f-4cf4-a6a1-9333c87d1001',
      houseObjectId: '7800000000000000000000101',
      fullName: 'г Санкт-Петербург, Невский пр-кт, д 28, помещ 4-Н',
      region: 'Санкт-Петербург',
      city: 'Санкт-Петербург',
      district: 'Центральный',
      street: 'Невский пр-кт',
      house: 'д 28',
      room: 'помещ 4-Н',
      postalCode: '191186',
      cadastralNumber: '780000000001',
      cityId: CITY_IDS.saintPetersburg,
      districtId: DISTRICT_IDS.saintPetersburgCentral,
      path: [
        pathItem('78', 'c2deb16a-0330-4f05-821f-1d09c93331e6', 'Санкт-Петербург', 'г', 1),
        pathItem('7800000000000001', 'c0b93502-28e3-4ec4-9d9a-ad1e57da1001', 'Невский', 'пр-кт', 8),
      ],
    }),
  ];
}

function buildAddressItem(params: {
  objectId: string;
  objectGuid: string;
  houseObjectId?: string;
  fullName: string;
  region: string;
  city: string;
  district: string;
  street: string;
  house: string;
  room?: string;
  postalCode: string;
  cadastralNumber: string;
  cityId: string;
  districtId: string;
  path: FiasAddressPathItem[];
}): FiasAddressItem {
  const housePathItem = pathItem(
    params.houseObjectId ?? params.objectId,
    params.objectGuid,
    params.house.replace(/^д\s+/i, ''),
    'д',
    10,
  );
  const roomPathItem = params.room
    ? pathItem(
        params.objectId,
        params.objectGuid,
        params.room.replace(/^(кв|помещ)\s+/i, ''),
        params.room.toLowerCase().startsWith('помещ') ? 'помещ' : 'кв',
        11,
      )
    : undefined;
  const hierarchy = [...params.path, housePathItem, ...(roomPathItem ? [roomPathItem] : [])];

  return create(FiasAddressItemSchema, {
    objectId: params.objectId,
    objectGuid: params.objectGuid,
    fullName: params.fullName,
    objectLevelId: params.room ? 11 : 10,
    addressType: MUNICIPAL_ADDRESS_TYPE,
    path: hierarchy,
    hierarchy,
    addressDetails: create(FiasAddressDetailsSchema, {
      postalCode: params.postalCode,
      region: params.region,
      city: params.city,
      district: params.district,
      street: params.street,
      house: params.house,
      room: params.room,
      cadastralNumber: params.cadastralNumber,
    }),
    isActive: true,
    cityId: params.cityId,
    districtId: params.districtId,
  });
}

function pathItem(
  objectId: string,
  objectGuid: string,
  name: string,
  typeName: string,
  objectLevelId: number,
): FiasAddressPathItem {
  return create(FiasAddressPathItemSchema, {
    objectId,
    objectGuid,
    name,
    typeName,
    fullName: `${typeName} ${name}`.trim(),
    objectLevelId,
    isActive: true,
  });
}

function normalizeSearchText(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ');
}

function toSearchTokens(value: string | undefined): string[] {
  return normalizeSearchText(value)
    .split(' ')
    .map(normalizeAddressToken)
    .filter((token) => token.length >= 2);
}

function normalizeAddressToken(token: string): string {
  const aliases: Record<string, string> = {
    город: 'г',
    г: 'г',
    область: 'обл',
    обл: 'обл',
    улица: 'ул',
    ул: 'ул',
    дом: 'д',
    д: 'д',
    квартира: 'кв',
    кв: 'кв',
    помещение: 'помещ',
    помещ: 'помещ',
    проспект: 'пр',
    пр: 'пр',
    пркт: 'пр',
  };

  return aliases[token] ?? token;
}
