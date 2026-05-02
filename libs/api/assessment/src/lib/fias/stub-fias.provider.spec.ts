import { Code, ConnectError } from '@connectrpc/connect';
import { StubFiasProvider } from './stub-fias.provider';

describe('StubFiasProvider', () => {
  const provider = new StubFiasProvider();

  it('should return address hints for a matching query', async () => {
    const hints = await provider.getAddressHint({ query: 'Екатеринбург Малышева' });

    expect(hints).toHaveLength(1);
    expect(hints[0]).toEqual(
      expect.objectContaining({
        objectId: '6600000100000000000000001',
        objectGuid: 'b1f7b1a0-8a2c-4b1b-9b7f-9d764a3a1001',
        fullName: 'Свердловская обл, г Екатеринбург, ул Малышева, д 16',
        objectLevelId: 10,
        addressType: 2,
        isActive: true,
        cityId: 'c097f53d-e513-47c4-a72b-07a304711ce3',
        districtId: '30448518-de64-4b0f-a080-79a4e7ac1c86',
      }),
    );
  });

  it('should return a full address item by object_id', async () => {
    const item = await provider.getAddressItemById('6600000100000000000000002');

    expect(item.fullName).toBe('Свердловская обл, г Екатеринбург, ул Ленина, д 10');
    expect(item.path.length).toBeGreaterThan(0);
    expect(item.hierarchy.length).toBeGreaterThan(0);
    expect(item.addressDetails).toEqual(
      expect.objectContaining({
        city: 'Екатеринбург',
        street: 'ул Ленина',
        house: 'д 10',
        cadastralNumber: '660000000002',
      }),
    );
  });

  it('should return an empty result for an unrelated query', async () => {
    await expect(provider.getAddressHint({ query: 'адрес которого нет' })).resolves.toEqual([]);
  });

  it('should report not found for an unknown object_id', async () => {
    await expect(provider.getAddressItemById('missing-object-id')).rejects.toEqual(
      expect.objectContaining<Partial<ConnectError>>({
        code: Code.NotFound,
      }),
    );
  });

  it('should search address items by parts', async () => {
    const items = await provider.searchByParts({
      city: 'Москва',
      street: 'Тверская',
      house: '7',
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.objectId).toBe('7700000000000000000000001');
  });
});

