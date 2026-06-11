import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Code, ConnectError, createClient } from '@connectrpc/connect';
import { RPC_TRANSPORT, TokenStore, UserRole, WebLoggerService } from '@notary-portal/ui';
import { AuthService } from './auth.service';

jest.mock('@connectrpc/connect', () => {
  const actual = jest.requireActual('@connectrpc/connect');
  return {
    ...actual,
    createClient: jest.fn(),
  };
});

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function makeJwt(payload: object): string {
  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64url({ alg: 'HS256' })}.${b64url(payload)}.sig`;
}

const NOW = Math.floor(Date.now() / 1000);
const TOKEN = makeJwt({ sub: 'u1', email: 'a@b.com', role: '1', iat: NOW, exp: NOW + 900 });
const EXPIRED = makeJwt({ sub: 'u1', email: 'a@b.com', role: '1', iat: 0, exp: 1 });

describe('TokenStore', () => {
  let store: TokenStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(TokenStore);
    store.clear();
  });

  it('should be created', () => expect(store).toBeTruthy());

  it('should not be logged in initially', () => {
    expect(store.isLoggedIn()).toBe(false);
    expect(store.getAccessToken()).toBeNull();
  });

  it('should become logged in after setTokens', () => {
    store.setTokens(TOKEN, 'rt', {
      id: 'u1',
      email: 'a@b.com',
      fullName: 'Test',
      role: 1,
      phoneNumber: '',
      isActive: true,
    });
    expect(store.isLoggedIn()).toBe(true);
    expect(store.role()).toBe(UserRole.Applicant);
    expect(store.getAccessToken()).toBe(TOKEN);
  });

  it('should return null for expired access token', () => {
    store.setTokens(EXPIRED, 'rt', {});
    expect(store.getAccessToken()).toBeNull();
  });

  it('should clear state on clear()', () => {
    store.setTokens(TOKEN, 'rt', {});
    store.clear();
    expect(store.isLoggedIn()).toBe(false);
    expect(store.getRefreshToken()).toBeNull();
  });
});

describe('AuthService browser logging', () => {
  let service: AuthService;
  let client: {
    login: jest.Mock;
    register: jest.Mock;
    forgotPassword: jest.Mock;
    resetPassword: jest.Mock;
    refreshToken: jest.Mock;
    logout: jest.Mock;
  };
  let logger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };
  let router: {
    url: string;
    navigateByUrl: jest.Mock;
  };

  beforeEach(() => {
    sessionStorage.clear();
    client = {
      login: jest.fn(),
      register: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
    };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    router = {
      url: '/auth',
      navigateByUrl: jest.fn().mockResolvedValue(true),
    };
    mockCreateClient.mockReturnValue(client as never);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        TokenStore,
        { provide: RPC_TRANSPORT, useValue: {} },
        { provide: Router, useValue: router },
        { provide: WebLoggerService, useValue: logger },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('logs login submit and success without storing the password', async () => {
    client.login.mockResolvedValue({
      result: {
        accessToken: TOKEN,
        refreshToken: 'refresh-token',
        user: authUser(UserRole.Applicant),
      },
    });

    await service.login(' User@Example.Com ', 'Password123');

    expect(logger.info).toHaveBeenCalledWith(
      'auth.login.submitted',
      expect.objectContaining({
        emailDomain: 'example.com',
        outcome: 'submitted',
        hasSession: false,
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'auth.login.succeeded',
      expect.objectContaining({
        emailDomain: 'example.com',
        outcome: 'succeeded',
        role: 'applicant',
      }),
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('Password123');
  });

  it('logs expected login failures as warnings without storing the password', async () => {
    client.login.mockRejectedValue(new ConnectError('invalid credentials', Code.Unauthenticated));

    await service.login('user@example.com', 'Password123');

    expect(logger.warn).toHaveBeenCalledWith(
      'auth.login.failed',
      expect.objectContaining({
        emailDomain: 'example.com',
        outcome: 'failed',
        reason: 'rpc_unauthenticated',
      }),
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('Password123');
  });

  it('logs register submit and success without storing password or phone', async () => {
    client.register.mockResolvedValue({
      result: {
        accessToken: TOKEN,
        refreshToken: 'refresh-token',
        user: authUser(UserRole.Applicant),
      },
    });

    await service.register({
      email: 'user@example.com',
      password: 'Password123',
      fullName: 'Test User',
      phoneNumber: '+79991234567',
      role: UserRole.Applicant,
    });

    expect(logger.info).toHaveBeenCalledWith(
      'auth.register.submitted',
      expect.objectContaining({
        emailDomain: 'example.com',
        role: 'applicant',
        outcome: 'submitted',
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'auth.register.succeeded',
      expect.objectContaining({
        emailDomain: 'example.com',
        role: 'applicant',
        outcome: 'succeeded',
      }),
    );
    const payload = JSON.stringify(logger.info.mock.calls);
    expect(payload).not.toContain('Password123');
    expect(payload).not.toContain('+79991234567');
  });

  it('logs expected register failures as warnings', async () => {
    client.register.mockRejectedValue(
      new ConnectError('email already registered', Code.AlreadyExists),
    );

    await service.register({
      email: 'user@example.com',
      password: 'Password123',
      fullName: 'Test User',
      phoneNumber: '+79991234567',
      role: UserRole.Applicant,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'auth.register.failed',
      expect.objectContaining({
        emailDomain: 'example.com',
        outcome: 'failed',
        reason: 'rpc_already_exists',
        role: 'applicant',
      }),
    );
    const payload = JSON.stringify(logger.warn.mock.calls);
    expect(payload).not.toContain('Password123');
    expect(payload).not.toContain('+79991234567');
  });

  it('logs forgot password submit and success without storing the email', async () => {
    client.forgotPassword.mockResolvedValue({});

    await service.forgotPassword('user@example.com');

    expect(logger.info).toHaveBeenCalledWith(
      'auth.password_reset.request_submitted',
      expect.objectContaining({
        emailDomain: 'example.com',
        outcome: 'submitted',
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'auth.password_reset.request_succeeded',
      expect.objectContaining({
        emailDomain: 'example.com',
        outcome: 'succeeded',
      }),
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('user@example.com');
  });

  it('logs expected forgot password failures as warnings', async () => {
    client.forgotPassword.mockRejectedValue(
      new ConnectError('email is invalid', Code.InvalidArgument),
    );

    await expect(service.forgotPassword('user@example.com')).rejects.toBeInstanceOf(ConnectError);

    expect(logger.warn).toHaveBeenCalledWith(
      'auth.password_reset.request_failed',
      expect.objectContaining({
        emailDomain: 'example.com',
        outcome: 'failed',
        reason: 'rpc_invalid_argument',
      }),
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('user@example.com');
  });

  it('logs reset password success without storing reset token or new password', async () => {
    client.resetPassword.mockResolvedValue({});

    await service.resetPassword('reset-token', 'NewPassword123');

    expect(logger.info).toHaveBeenCalledWith(
      'auth.password_reset.submit_submitted',
      expect.objectContaining({
        outcome: 'submitted',
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'auth.password_reset.submit_succeeded',
      expect.objectContaining({
        outcome: 'succeeded',
      }),
    );
    const payload = JSON.stringify(logger.info.mock.calls);
    expect(payload).not.toContain('reset-token');
    expect(payload).not.toContain('NewPassword123');
  });

  it('logs unexpected reset password failures as errors', async () => {
    client.resetPassword.mockRejectedValue(
      new ConnectError('network unavailable', Code.Unavailable),
    );

    await expect(service.resetPassword('reset-token', 'NewPassword123')).rejects.toBeInstanceOf(
      ConnectError,
    );

    expect(logger.error).toHaveBeenCalledWith(
      'auth.password_reset.submit_failed',
      expect.objectContaining({
        outcome: 'failed',
        reason: 'rpc_unavailable',
      }),
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('reset-token');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('NewPassword123');
  });
});

function authUser(role: UserRole) {
  return {
    id: 'u1',
    email: 'user@example.com',
    fullName: 'Test User',
    role,
    phoneNumber: '',
    isActive: true,
  };
}
