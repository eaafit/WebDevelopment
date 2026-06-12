import { BitrixOrdersConfigError, BitrixOrdersConfigService } from './bitrix-orders-config.service';

describe('BitrixOrdersConfigService', () => {
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
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  describe('when both env vars are valid', () => {
    it('reads webhook and portal URLs from env', () => {
      const service = new BitrixOrdersConfigService();
      expect(service.isConfigured()).toBe(true);
      expect(service.getWebhookUrl()).toBe('https://b24-test.bitrix24.ru/rest/1/abc123/');
      expect(service.getPortalUrl()).toBe('https://b24-test.bitrix24.ru');
    });

    it('trims surrounding whitespace', () => {
      process.env['BITRIX_WEBHOOK_URL'] = '  https://b24.bitrix24.ru/rest/1/abc/  ';
      const service = new BitrixOrdersConfigService();
      expect(service.getWebhookUrl()).toBe('https://b24.bitrix24.ru/rest/1/abc/');
    });
  });

  describe('when env vars are missing (graceful skip)', () => {
    it('reports isConfigured=false and does not throw on construction when BITRIX_WEBHOOK_URL is missing', () => {
      delete process.env['BITRIX_WEBHOOK_URL'];
      const service = new BitrixOrdersConfigService();
      expect(service.isConfigured()).toBe(false);
    });

    it('reports isConfigured=false when BITRIX_WEBHOOK_URL is whitespace-only', () => {
      process.env['BITRIX_WEBHOOK_URL'] = '   ';
      const service = new BitrixOrdersConfigService();
      expect(service.isConfigured()).toBe(false);
    });

    it('reports isConfigured=false when BITRIX_PORTAL_URL is missing', () => {
      delete process.env['BITRIX_PORTAL_URL'];
      const service = new BitrixOrdersConfigService();
      expect(service.isConfigured()).toBe(false);
    });

    it('getWebhookUrl throws when env was missing', () => {
      delete process.env['BITRIX_WEBHOOK_URL'];
      const service = new BitrixOrdersConfigService();
      expect(() => service.getWebhookUrl()).toThrow(BitrixOrdersConfigError);
    });

    it('getPortalUrl throws when env was missing', () => {
      delete process.env['BITRIX_PORTAL_URL'];
      const service = new BitrixOrdersConfigService();
      expect(() => service.getPortalUrl()).toThrow(BitrixOrdersConfigError);
    });
  });

  describe('when env vars are present but invalid (fail-fast)', () => {
    it('throws when BITRIX_WEBHOOK_URL is not a valid URL', () => {
      process.env['BITRIX_WEBHOOK_URL'] = 'not-a-url';
      expect(() => new BitrixOrdersConfigService()).toThrow(BitrixOrdersConfigError);
    });

    it('throws when BITRIX_WEBHOOK_URL uses http instead of https', () => {
      process.env['BITRIX_WEBHOOK_URL'] = 'http://b24.bitrix24.ru/rest/1/abc/';
      expect(() => new BitrixOrdersConfigService()).toThrow(/must use https/);
    });

    it('throws when BITRIX_PORTAL_URL uses http instead of https', () => {
      process.env['BITRIX_PORTAL_URL'] = 'http://b24.bitrix24.ru';
      expect(() => new BitrixOrdersConfigService()).toThrow(/must use https/);
    });
  });
});