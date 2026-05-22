import { AxiosError, type AxiosInstance } from 'axios';

import { BitrixLeadsApiService } from './bitrix-leads-api.service';
import { BitrixLeadsConfigService } from './bitrix-leads-config.service';
import {
  BitrixAuthError,
  BitrixRateLimitError,
  BitrixUnavailableError,
  BitrixUnknownError,
  BitrixValidationError,
} from './bitrix-leads.errors';

describe('BitrixLeadsApiService', () => {
  const originalWebhook = process.env['BITRIX_WEBHOOK_URL'];
  const originalPortal = process.env['BITRIX_PORTAL_URL'];

  let post: jest.Mock;
  let service: BitrixLeadsApiService;

  beforeEach(() => {
    process.env['BITRIX_WEBHOOK_URL'] = 'https://test.bitrix24.ru/rest/1/abc/';
    process.env['BITRIX_PORTAL_URL'] = 'https://test.bitrix24.ru';
    post = jest.fn();
    const http = { post } as unknown as AxiosInstance;
    service = new BitrixLeadsApiService(new BitrixLeadsConfigService(), http);
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

  describe('success', () => {
    it('returns lead id when Bitrix responds with result', async () => {
      post.mockResolvedValueOnce({ data: { result: 5821, time: {} } });

      await expect(service.createLead({ TITLE: 'Тест' })).resolves.toBe(5821);
    });

    it('posts to crm.lead.add.json with fields and REGISTER_SONET_EVENT', async () => {
      post.mockResolvedValueOnce({ data: { result: 1 } });

      await service.createLead({ TITLE: 'Тест' });

      expect(post).toHaveBeenCalledTimes(1);
      const [url, body] = post.mock.calls[0];
      expect(url).toBe('https://test.bitrix24.ru/rest/1/abc/crm.lead.add.json');
      expect(body).toEqual({
        fields: { TITLE: 'Тест' },
        params: { REGISTER_SONET_EVENT: 'Y' },
      });
    });
  });

  describe('Bitrix returned error in body', () => {
    it('maps NO_AUTH_FOUND to BitrixAuthError', async () => {
      post.mockResolvedValueOnce({
        data: { error: 'NO_AUTH_FOUND', error_description: 'Bad token' },
      });

      await expect(service.createLead({})).rejects.toBeInstanceOf(BitrixAuthError);
    });

    it('maps ACCESS_DENIED to BitrixAuthError', async () => {
      post.mockResolvedValueOnce({ data: { error: 'ACCESS_DENIED' } });

      await expect(service.createLead({})).rejects.toBeInstanceOf(BitrixAuthError);
    });

    it('maps QUERY_LIMIT_EXCEEDED to BitrixRateLimitError', async () => {
      post.mockResolvedValueOnce({
        data: { error: 'QUERY_LIMIT_EXCEEDED', error_description: 'Too fast' },
      });

      await expect(service.createLead({})).rejects.toBeInstanceOf(BitrixRateLimitError);
    });

    it('maps INTERNAL_SERVER_ERROR to BitrixUnavailableError', async () => {
      post.mockResolvedValueOnce({ data: { error: 'INTERNAL_SERVER_ERROR' } });

      await expect(service.createLead({})).rejects.toBeInstanceOf(BitrixUnavailableError);
    });

    it('maps unknown error code to BitrixValidationError with code in message', async () => {
      post.mockResolvedValueOnce({
        data: { error: 'ERROR_PHONE_FORMAT', error_description: 'Bad phone' },
      });

      const promise = service.createLead({});
      await expect(promise).rejects.toBeInstanceOf(BitrixValidationError);
      await expect(promise).rejects.toThrow(/ERROR_PHONE_FORMAT/);
    });
  });

  describe('HTTP/network errors', () => {
    it('maps 5xx response to BitrixUnavailableError', async () => {
      post.mockRejectedValueOnce(
        new AxiosError(
          'Request failed with status code 500',
          'ERR_BAD_RESPONSE',
          undefined,
          null,
          {
            status: 500,
            data: {},
            headers: {},
            statusText: 'Internal Server Error',
            config: {} as never,
          },
        ),
      );

      await expect(service.createLead({})).rejects.toBeInstanceOf(BitrixUnavailableError);
    });

    it('maps network error (no response) to BitrixUnavailableError', async () => {
      post.mockRejectedValueOnce(new AxiosError('ENOTFOUND', 'ERR_NETWORK'));

      await expect(service.createLead({})).rejects.toBeInstanceOf(BitrixUnavailableError);
    });

    it('maps 4xx with Bitrix error body to a mapped Bitrix error', async () => {
      post.mockRejectedValueOnce(
        new AxiosError(
          'Request failed with status code 401',
          'ERR_BAD_REQUEST',
          undefined,
          null,
          {
            status: 401,
            data: { error: 'NO_AUTH_FOUND', error_description: 'Expired' },
            headers: {},
            statusText: 'Unauthorized',
            config: {} as never,
          },
        ),
      );

      await expect(service.createLead({})).rejects.toBeInstanceOf(BitrixAuthError);
    });

    it('maps non-axios exception to BitrixUnknownError', async () => {
      post.mockRejectedValueOnce(new Error('something weird'));

      await expect(service.createLead({})).rejects.toBeInstanceOf(BitrixUnknownError);
    });
  });

  describe('malformed response', () => {
    it('throws BitrixUnknownError when result is not a number', async () => {
      post.mockResolvedValueOnce({ data: { result: 'not a number' } });

      await expect(service.createLead({})).rejects.toBeInstanceOf(BitrixUnknownError);
    });
  });
});
