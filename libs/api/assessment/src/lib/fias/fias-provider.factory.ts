import { Logger } from '@nestjs/common';
import { FIAS_PROVIDER, type FiasProvider } from './fias-provider';
import { StubFiasProvider } from './stub-fias.provider';

const logger = new Logger('FiasProviderFactory');

export const fiasProviderFactory = {
  provide: FIAS_PROVIDER,
  useFactory: (): FiasProvider => {
    const providerMode = (process.env['FIAS_PROVIDER'] ?? 'stub').trim().toLowerCase();

    if (providerMode === 'real') {
      logger.warn(
        'FIAS_PROVIDER=real is selected, but real API calls are disabled; falling back to stub',
      );
      return new StubFiasProvider();
    }

    if (providerMode !== 'stub') {
      logger.warn(`Unknown FIAS_PROVIDER=${providerMode}; falling back to stub`);
    }

    return new StubFiasProvider();
  },
};
