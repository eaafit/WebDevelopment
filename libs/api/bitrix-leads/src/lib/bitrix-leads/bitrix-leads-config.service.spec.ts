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

  it('reads valid webhook and portal URLs from env', () => {
    const service = new BitrixLeadsConfigService();

    expect(service.getWebhookUrl()).toBe('https://b24-test.bitrix24.ru/rest/1/abc123/');
    expect(service.getPortalUrl()).toBe('https://b24-test.bitrix24.ru');
  });

  it('trims surrounding whitespace', () => {
    process.env['BITRIX_WEBHOOK_URL'] = '  https://b24.bitrix24.ru/rest/1/abc/  ';

    const service = new BitrixLeadsConfigService();

    expect(service.getWebhookUrl()).toBe('https://b24.bitrix24.ru/rest/1/abc/');
  });

  it('throws BitrixLeadsConfigError when BITRIX_WEBHOOK_URL is missing', () => {
    delete process.env['BITRIX_WEBHOOK_URL'];

    expect(() => new BitrixLeadsConfigService()).toThrow(BitrixLeadsConfigError);
    expect(() => new BitrixLeadsConfigService()).toThrow(/BITRIX_WEBHOOK_URL обязательна/);
  });

  it('throws when BITRIX_WEBHOOK_URL is an empty string', () => {
    process.env['BITRIX_WEBHOOK_URL'] = '   ';

    expect(() => new BitrixLeadsConfigService()).toThrow(/BITRIX_WEBHOOK_URL обязательна/);
  });

  it('throws when BITRIX_WEBHOOK_URL is not a valid URL', () => {
    process.env['BITRIX_WEBHOOK_URL'] = 'not-a-url';

    expect(() => new BitrixLeadsConfigService()).toThrow(/не является валидным URL/);
  });

  it('throws when BITRIX_WEBHOOK_URL uses http instead of https', () => {
    process.env['BITRIX_WEBHOOK_URL'] = 'http://b24.bitrix24.ru/rest/1/abc/';

    expect(() => new BitrixLeadsConfigService()).toThrow(/должна использовать https/);
  });

  it('throws when BITRIX_PORTAL_URL is missing', () => {
    delete process.env['BITRIX_PORTAL_URL'];

    expect(() => new BitrixLeadsConfigService()).toThrow(/BITRIX_PORTAL_URL обязательна/);
  });

  it('throws when BITRIX_PORTAL_URL uses http instead of https', () => {
    process.env['BITRIX_PORTAL_URL'] = 'http://b24.bitrix24.ru';

    expect(() => new BitrixLeadsConfigService()).toThrow(/должна использовать https/);
  });
});
