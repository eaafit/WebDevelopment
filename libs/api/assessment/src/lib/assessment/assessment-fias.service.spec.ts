import { create } from '@bufbuild/protobuf';
import {
  GetFiasAddressHintsRequestSchema,
  GetFiasAddressItemByIdRequestSchema,
} from '@notary-portal/api-contracts';
import { AssessmentService } from './assessment.service';
import { StubFiasProvider } from '../fias/stub-fias.provider';

describe('AssessmentService FIAS flow', () => {
  const service = new AssessmentService(
    {} as never,
    {} as never,
    {} as never,
    new StubFiasProvider(),
  );

  it('should map FIAS provider hints to RPC response DTO', async () => {
    const response = await service.getFiasAddressHints(
      create(GetFiasAddressHintsRequestSchema, {
        query: 'Екатеринбург Ленина',
        limit: 5,
      }),
    );

    expect(response.hints).toHaveLength(1);
    expect(response.hints[0]).toEqual(
      expect.objectContaining({
        objectId: '6600000100000000000000002',
        fullName: 'Свердловская обл, г Екатеринбург, ул Ленина, д 10, кв 45',
        cityId: 'c097f53d-e513-47c4-a72b-07a304711ce3',
        districtId: '30448518-de64-4b0f-a080-79a4e7ac1c86',
      }),
    );
  });

  it('should return an empty RPC response for a short query', async () => {
    const response = await service.getFiasAddressHints(
      create(GetFiasAddressHintsRequestSchema, { query: 'ек' }),
    );

    expect(response.hints).toEqual([]);
  });

  it('should map a selected object_id to a full RPC address item', async () => {
    const response = await service.getFiasAddressItemById(
      create(GetFiasAddressItemByIdRequestSchema, {
        objectId: '6600000100000000000000001',
      }),
    );

    expect(response.item).toEqual(
      expect.objectContaining({
        objectId: '6600000100000000000000001',
        objectGuid: 'b1f7b1a0-8a2c-4b1b-9b7f-9d764a3a1001',
        fullName: 'Свердловская обл, г Екатеринбург, ул Малышева, д 16',
      }),
    );
    expect(response.item?.addressDetails).toEqual(
      expect.objectContaining({
        city: 'Екатеринбург',
        street: 'ул Малышева',
        house: 'д 16',
      }),
    );
  });
});
