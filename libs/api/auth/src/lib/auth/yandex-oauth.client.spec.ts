import { OAuthClientError } from './oauth-client';
import { YandexOAuthClient } from './yandex-oauth.client';

describe('YandexOAuthClient', () => {
  const originalEnv = process.env;
  let client: YandexOAuthClient;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      YANDEX_CLIENT_ID: 'test-client-id',
      YANDEX_CLIENT_SECRET: 'test-client-secret',
      YANDEX_REDIRECT_URI: 'http://localhost:4200/auth/oauth/yandex/callback',
    };
    client = new YandexOAuthClient();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  function mockFetch(response: { ok: boolean; status?: number; json?: unknown }): jest.Mock {
    const fn = jest.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 400),
      json: async () => response.json ?? {},
    });
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  describe('buildAuthorizeUrl', () => {
    it('builds a Yandex consent URL with client_id, redirect_uri, scope and state', () => {
      const url = new URL(client.buildAuthorizeUrl('signed-state-123'));

      expect(url.origin + url.pathname).toBe('https://oauth.yandex.ru/authorize');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe(
        'http://localhost:4200/auth/oauth/yandex/callback',
      );
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('login:email login:info');
      expect(url.searchParams.get('state')).toBe('signed-state-123');
    });

    it('throws when required env is missing', () => {
      delete process.env['YANDEX_CLIENT_ID'];
      expect(() => client.buildAuthorizeUrl('s')).toThrow(OAuthClientError);
    });

    it('does not expose a PKCE method (Yandex does not require it)', () => {
      expect((client as { createPkce?: unknown }).createPkce).toBeUndefined();
    });
  });

  describe('exchangeCode', () => {
    it('posts the code to Yandex and returns the access token', async () => {
      const fetchMock = mockFetch({ ok: true, json: { access_token: 'ya-access' } });

      const result = await client.exchangeCode({ code: 'auth-code-xyz' });

      expect(result).toEqual({ accessToken: 'ya-access' });
      const [endpoint, init] = fetchMock.mock.calls[0];
      expect(endpoint).toBe('https://oauth.yandex.ru/token');
      expect(init.method).toBe('POST');
      expect(init.body).toContain('grant_type=authorization_code');
      expect(init.body).toContain('auth-code-xyz');
    });

    it('throws OAuthClientError on non-2xx without leaking the body', async () => {
      mockFetch({ ok: false, status: 400, json: { error: 'invalid_grant' } });
      await expect(client.exchangeCode({ code: 'bad-code' })).rejects.toMatchObject({
        name: 'OAuthClientError',
        status: 400,
      });
    });

    it('throws when access_token is absent', async () => {
      mockFetch({ ok: true, json: {} });
      await expect(client.exchangeCode({ code: 'code' })).rejects.toBeInstanceOf(OAuthClientError);
    });
  });

  describe('getUserInfo', () => {
    it('maps the Yandex profile and normalizes default_email', async () => {
      const fetchMock = mockFetch({
        ok: true,
        json: { id: 'ya-id-1', default_email: ' User@Yandex.RU ', real_name: 'Иван Петров' },
      });

      const info = await client.getUserInfo('ya-access');

      expect(info).toEqual({
        providerUserId: 'ya-id-1',
        email: 'user@yandex.ru',
        emailVerified: true,
        fullName: 'Иван Петров',
      });
      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers.Authorization).toBe('OAuth ya-access');
    });

    it('returns an empty unverified email when default_email is absent', async () => {
      mockFetch({ ok: true, json: { id: 'ya-id-2', login: 'vasya' } });
      const info = await client.getUserInfo('t');
      expect(info.email).toBe('');
      expect(info.emailVerified).toBe(false);
      expect(info.fullName).toBe('vasya');
    });

    it('throws when id is missing', async () => {
      mockFetch({ ok: true, json: { default_email: 'a@b.com' } });
      await expect(client.getUserInfo('t')).rejects.toBeInstanceOf(OAuthClientError);
    });

    it('throws OAuthClientError on non-2xx', async () => {
      mockFetch({ ok: false, status: 401 });
      await expect(client.getUserInfo('t')).rejects.toMatchObject({ status: 401 });
    });
  });
});
