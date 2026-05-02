import { createAuthInterceptor, createRequestIdInterceptor } from './rpc-transport';

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
});
