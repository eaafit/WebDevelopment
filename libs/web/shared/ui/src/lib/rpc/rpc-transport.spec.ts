import {
  buildRpcBaseUrl,
  createAuthInterceptor,
  createRequestIdInterceptor,
  resolveRpcBaseUrl,
} from './rpc-transport';

describe('resolveRpcBaseUrl', () => {
  it('uses localhost:3000 during SSR', () => {
    expect(resolveRpcBaseUrl(undefined)).toBe('http://localhost:3000');
  });

  it('keeps localhost:4200 on the portal origin', () => {
    expect(
      resolveRpcBaseUrl({
        protocol: 'http:',
        hostname: 'localhost',
        port: '4200',
        origin: 'http://localhost:4200',
      }),
    ).toBe('http://localhost:4200');
  });

  it('keeps localhost:3000 when UI is already served from the API port', () => {
    expect(
      resolveRpcBaseUrl({
        protocol: 'http:',
        hostname: 'localhost',
        port: '3000',
        origin: 'http://localhost:3000',
      }),
    ).toBe('http://localhost:3000');
  });

  it('keeps same origin when UI and API share a host', () => {
    expect(
      resolveRpcBaseUrl({
        protocol: 'http:',
        hostname: 'portal.example.test',
        port: '',
        origin: 'http://portal.example.test',
      }),
    ).toBe('http://portal.example.test');
  });
});

describe('buildRpcBaseUrl', () => {
  it('delegates to the current browser location', () => {
    expect(buildRpcBaseUrl()).toBe(resolveRpcBaseUrl(window.location));
  });
});

describe('createRequestIdInterceptor', () => {
  it('adds X-Request-Id to RPC requests', async () => {
    const interceptor = createRequestIdInterceptor(() => 'rpc-request-id');
    const next = jest.fn(async (req) => req);
    const req = {
      header: new Headers(),
    };

    await interceptor(next)(req as never);

    expect(req.header.get('X-Request-Id')).toBe('rpc-request-id');
    expect(next).toHaveBeenCalledWith(req);
  });

  it('keeps an existing X-Request-Id header', async () => {
    const interceptor = createRequestIdInterceptor(() => 'generated-request-id');
    const next = jest.fn(async (req) => req);
    const req = {
      header: new Headers({ 'X-Request-Id': 'existing-request-id' }),
    };

    await interceptor(next)(req as never);

    expect(req.header.get('X-Request-Id')).toBe('existing-request-id');
  });

  it('works together with the auth interceptor', async () => {
    const requestIdInterceptor = createRequestIdInterceptor(() => 'rpc-request-id');
    const authInterceptor = createAuthInterceptor(
      {
        getToken: () => 'access-token',
        refresh: jest.fn(async () => true),
      },
      { navigateByUrl: jest.fn() } as never,
    );
    const next = jest.fn(async (req) => req);
    const req = {
      url: 'http://localhost:3000/notary.user.v1alpha1.UserService/GetProfile',
      header: new Headers(),
    };

    await requestIdInterceptor(authInterceptor(next))(req as never);

    expect(req.header.get('X-Request-Id')).toBe('rpc-request-id');
    expect(req.header.get('Authorization')).toBe('Bearer access-token');
    expect(next).toHaveBeenCalledWith(req);
  });

  it('keeps login public but sends auth for logout', async () => {
    const authInterceptor = createAuthInterceptor(
      {
        getToken: () => 'access-token',
        refresh: jest.fn(async () => true),
      },
      { navigateByUrl: jest.fn() } as never,
    );
    const next = jest.fn(async (req) => req);
    const loginReq = {
      url: 'http://localhost:3000/notary.auth.v1alpha1.AuthService/Login',
      header: new Headers(),
    };
    const logoutReq = {
      url: 'http://localhost:3000/notary.auth.v1alpha1.AuthService/Logout',
      header: new Headers(),
    };

    await authInterceptor(next)(loginReq as never);
    await authInterceptor(next)(logoutReq as never);

    expect(loginReq.header.get('Authorization')).toBeNull();
    expect(logoutReq.header.get('Authorization')).toBe('Bearer access-token');
  });
});
