import { GoogleOAuthClient, GoogleOAuthError } from './google-oauth.client';

describe('GoogleOAuthClient', () => {
  const originalEnv = process.env;
  let client: GoogleOAuthClient;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:4200/auth/oauth/google/callback',
    };
    client = new GoogleOAuthClient();
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
    it('builds a Google consent URL with client_id, redirect_uri, scope and state', () => {
      const url = new URL(client.buildAuthorizeUrl('signed-state-123'));

      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe(
        'http://localhost:4200/auth/oauth/google/callback',
      );
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('openid email profile');
      expect(url.searchParams.get('state')).toBe('signed-state-123');
    });

    it('throws when required env is missing', () => {
      delete process.env['GOOGLE_CLIENT_ID'];
      expect(() => client.buildAuthorizeUrl('s')).toThrow(GoogleOAuthError);
    });
  });

  describe('exchangeCode', () => {
    it('posts the code to Google and returns tokens', async () => {
      const fetchMock = mockFetch({
        ok: true,
        json: { access_token: 'google-access', id_token: 'google-id' },
      });

      const result = await client.exchangeCode('auth-code-xyz');

      expect(result).toEqual({ accessToken: 'google-access', idToken: 'google-id' });
      const [endpoint, init] = fetchMock.mock.calls[0];
      expect(endpoint).toBe('https://oauth2.googleapis.com/token');
      expect(init.method).toBe('POST');
      expect(init.body).toContain('grant_type=authorization_code');
      expect(init.body).toContain('auth-code-xyz');
    });

    it('throws GoogleOAuthError on non-2xx without leaking the body', async () => {
      mockFetch({ ok: false, status: 401, json: { error: 'invalid_grant' } });
      await expect(client.exchangeCode('bad-code')).rejects.toMatchObject({
        name: 'GoogleOAuthError',
        status: 401,
      });
    });

    it('throws when access_token is absent', async () => {
      mockFetch({ ok: true, json: { id_token: 'only-id' } });
      await expect(client.exchangeCode('code')).rejects.toBeInstanceOf(GoogleOAuthError);
    });
  });

  describe('getUserInfo', () => {
    it('maps the Google profile and normalizes the email', async () => {
      mockFetch({
        ok: true,
        json: { sub: 'google-sub-1', email: ' User@Example.COM ', email_verified: true, name: 'Test User' },
      });

      const info = await client.getUserInfo('google-access');

      expect(info).toEqual({
        providerUserId: 'google-sub-1',
        email: 'user@example.com',
        emailVerified: true,
        fullName: 'Test User',
      });
    });

    it('parses string email_verified flag and falls back to email as name', async () => {
      mockFetch({ ok: true, json: { sub: 's', email: 'a@b.com', email_verified: 'true' } });
      const info = await client.getUserInfo('t');
      expect(info.emailVerified).toBe(true);
      expect(info.fullName).toBe('a@b.com');
    });

    it('throws when sub or email is missing', async () => {
      mockFetch({ ok: true, json: { email: 'a@b.com' } });
      await expect(client.getUserInfo('t')).rejects.toBeInstanceOf(GoogleOAuthError);
    });

    it('throws GoogleOAuthError on non-2xx', async () => {
      mockFetch({ ok: false, status: 403 });
      await expect(client.getUserInfo('t')).rejects.toMatchObject({ status: 403 });
    });
  });
});
