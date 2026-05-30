import {
  BitrixLeadsConfigError,
  BitrixLeadsConfigService,
} from './bitrix-leads-config.service';

describe('BitrixLeadsConfigService', () => {
  const originalWebhook = process.env['BITRIX_WEBHOOK_URL'];
  const originalPortal = process.env['BITRIX_PORTAL_URL'];

  beforeEach(() => {
    process.env['BITRIX_WEBHOOK_URL'] = 'https://b24-test.bitrix24.ru/rest/1/abc123/';
    process.env['BITRIX_PORTAL_URL'] = 'https://b24-test.bitrix24.ru';
  });

  afterAll(() => {
    restore('BITRIX_WEBHOOK_URL', originalWebhook);
    restore('BITRIX_PORTAL_URL', originalPortal);
  });

  function restore(key: string, value: string | undefined): void {
    if (value === undefined) {
      delete process.env[key];
      return;
    }
    process.env[key] = value;
  }

  describe('when both env vars are valid', () => {
    it('reads webhook and portal URLs from env', () => {
      const service = new BitrixLeadsConfigService();

      expect(service.isConfigured()).toBe(true);
      expect(service.getWebhookUrl()).toBe('https://b24-test.bitrix24.ru/rest/1/abc123/');
      expect(service.getPortalUrl()).toBe('https://b24-test.bitrix24.ru');
    });

    it('trims surrounding whitespace', () => {
      process.env['BITRIX_WEBHOOK_URL'] = '  https://b24.bitrix24.ru/rest/1/abc/  ';

      const service = new BitrixLeadsConfigService();

      expect(service.getWebhookUrl()).toBe('https://b24.bitrix24.ru/rest/1/abc/');
    });
  });

  describe('when env vars are missing (graceful skip)', () => {
    it('reports isConfigured=false and does not throw on construction when BITRIX_WEBHOOK_URL is missing', () => {
      delete process.env['BITRIX_WEBHOOK_URL'];

      const service = new BitrixLeadsConfigService();

      expect(service.isConfigured()).toBe(false);
    });

    it('reports isConfigured=false when BITRIX_WEBHOOK_URL is whitespace-only', () => {
      process.env['BITRIX_WEBHOOK_URL'] = '   ';

      const service = new BitrixLeadsConfigService();

      expect(service.isConfigured()).toBe(false);
    });

    it('reports isConfigured=false when BITRIX_PORTAL_URL is missing', () => {
      delete process.env['BITRIX_PORTAL_URL'];

      const service = new BitrixLeadsConfigService();

      expect(service.isConfigured()).toBe(false);
    });

    it('getWebhookUrl throws BitrixLeadsConfigError when accessed but env was missing', () => {
      delete process.env['BITRIX_WEBHOOK_URL'];
      const service = new BitrixLeadsConfigService();

      expect(() => service.getWebhookUrl()).toThrow(BitrixLeadsConfigError);
      expect(() => service.getWebhookUrl()).toThrow(/BITRIX_WEBHOOK_URL обязательна/);
    });

    it('getPortalUrl throws when accessed but env was missing', () => {
      delete process.env['BITRIX_PORTAL_URL'];
      const service = new BitrixLeadsConfigService();

      expect(() => service.getPortalUrl()).toThrow(/BITRIX_PORTAL_URL обязательна/);
    });
  });

  describe('when env vars are present but invalid (fail-fast on construction)', () => {
    it('throws when BITRIX_WEBHOOK_URL is not a valid URL', () => {
      process.env['BITRIX_WEBHOOK_URL'] = 'not-a-url';

      expect(() => new BitrixLeadsConfigService()).toThrow(/не является валидным URL/);
    });

    it('throws when BITRIX_WEBHOOK_URL uses http instead of https', () => {
      process.env['BITRIX_WEBHOOK_URL'] = 'http://b24.bitrix24.ru/rest/1/abc/';

      expect(() => new BitrixLeadsConfigService()).toThrow(/должна использовать https/);
    });

    it('throws when BITRIX_PORTAL_URL uses http instead of https', () => {
      process.env['BITRIX_PORTAL_URL'] = 'http://b24.bitrix24.ru';

      expect(() => new BitrixLeadsConfigService()).toThrow(/должна использовать https/);
    });
  });
});
