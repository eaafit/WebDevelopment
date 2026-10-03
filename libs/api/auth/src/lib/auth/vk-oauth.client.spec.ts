import { createHash } from 'crypto';
import { OAuthClientError } from './oauth-client';
import { VkOAuthClient } from './vk-oauth.client';

describe('VkOAuthClient', () => {
  const originalEnv = process.env;
  let client: VkOAuthClient;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      VK_CLIENT_ID: 'test-vk-client',
      VK_REDIRECT_URI: 'http://localhost:4200/auth/oauth/vk/callback',
      VK_CLIENT_SECRET: undefined,
    };
    client = new VkOAuthClient();
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

  describe('createPkce', () => {
    it('derives an S256 challenge from the verifier', () => {
      const { verifier, challenge } = client.createPkce();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
    });
  });

  describe('buildAuthorizeUrl', () => {
    it('builds a VK ID consent URL with PKCE challenge and scope', () => {
      const url = new URL(client.buildAuthorizeUrl('signed-state-1', 'challenge-1'));

      expect(url.origin + url.pathname).toBe('https://id.vk.ru/authorize');
      expect(url.searchParams.get('client_id')).toBe('test-vk-client');
      expect(url.searchParams.get('redirect_uri')).toBe(
        'http://localhost:4200/auth/oauth/vk/callback',
      );
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('email');
      expect(url.searchParams.get('state')).toBe('signed-state-1');
      expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('throws when the PKCE challenge is missing', () => {
      expect(() => client.buildAuthorizeUrl('s')).toThrow(OAuthClientError);
    });
  });

  describe('exchangeCode', () => {
    it('posts code, code_verifier and device_id to the VK token endpoint', async () => {
      const fetchMock = mockFetch({ ok: true, json: { access_token: 'vk-access' } });

      const result = await client.exchangeCode({
        code: 'vk-code',
        codeVerifier: 'verifier-1',
        deviceId: 'device-1',
      });

      expect(result).toEqual({ accessToken: 'vk-access' });
      const [endpoint, init] = fetchMock.mock.calls[0];
      expect(endpoint).toBe('https://id.vk.ru/oauth2/auth');
      expect(init.method).toBe('POST');
      expect(init.body).toContain('grant_type=authorization_code');
      expect(init.body).toContain('code_verifier=verifier-1');
      expect(init.body).toContain('device_id=device-1');
      // Без VK_CLIENT_SECRET секрет в теле не передаётся.
      expect(init.body).not.toContain('client_secret');
    });

    it('throws when the PKCE verifier is missing', async () => {
      await expect(
        client.exchangeCode({ code: 'c', deviceId: 'd' }),
      ).rejects.toBeInstanceOf(OAuthClientError);
    });

    it('throws when device_id is missing', async () => {
      await expect(
        client.exchangeCode({ code: 'c', codeVerifier: 'v' }),
      ).rejects.toBeInstanceOf(OAuthClientError);
    });

    it('throws OAuthClientError on non-2xx without leaking the body', async () => {
      mockFetch({ ok: false, status: 400, json: { error: 'invalid_grant' } });
      await expect(
        client.exchangeCode({ code: 'bad', codeVerifier: 'v', deviceId: 'd' }),
      ).rejects.toMatchObject({ name: 'OAuthClientError', status: 400 });
    });
  });

  describe('getUserInfo', () => {
    it('maps the VK user profile and normalizes the email', async () => {
      const fetchMock = mockFetch({
        ok: true,
        json: {
          user: { user_id: 'vk-1', first_name: 'Иван', last_name: 'Петров', email: ' User@VK.com ' },
        },
      });

      const info = await client.getUserInfo('vk-access');

      expect(info).toEqual({
        providerUserId: 'vk-1',
        email: 'user@vk.com',
        emailVerified: true,
        fullName: 'Иван Петров',
      });
      const [endpoint, init] = fetchMock.mock.calls[0];
      expect(endpoint).toBe('https://id.vk.ru/oauth2/user_info');
      expect(init.body).toContain('access_token=vk-access');
    });

    it('returns an empty unverified email when VK does not provide one', async () => {
      mockFetch({ ok: true, json: { user: { user_id: 'vk-2', first_name: 'Анна' } } });
      const info = await client.getUserInfo('t');
      expect(info.email).toBe('');
      expect(info.emailVerified).toBe(false);
      expect(info.fullName).toBe('Анна');
    });

    it('throws when user_id is missing', async () => {
      mockFetch({ ok: true, json: { user: { email: 'a@b.com' } } });
      await expect(client.getUserInfo('t')).rejects.toBeInstanceOf(OAuthClientError);
    });
  });
});
