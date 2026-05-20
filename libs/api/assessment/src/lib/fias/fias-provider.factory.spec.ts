import { fiasProviderFactory } from './fias-provider.factory';
import { StubFiasProvider } from './stub-fias.provider';

describe('fiasProviderFactory', () => {
  const originalProviderMode = process.env['FIAS_PROVIDER'];

  afterEach(() => {
    if (originalProviderMode === undefined) {
      delete process.env['FIAS_PROVIDER'];
      return;
    }

    process.env['FIAS_PROVIDER'] = originalProviderMode;
  });

  it('falls back to the stub provider while real FIAS calls are disabled', () => {
    process.env['FIAS_PROVIDER'] = 'real';

    expect(fiasProviderFactory.useFactory()).toBeInstanceOf(StubFiasProvider);
  });
});
