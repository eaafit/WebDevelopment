import { Logger } from '@nestjs/common';
import { OAuthStateError, OAuthStateService } from './oauth-state.service';

describe('OAuthStateService', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  function withEnv(overrides: Record<string, string | undefined>): OAuthStateService {
    process.env = { ...originalEnv, ...overrides };
    return new OAuthStateService();
  }

  it('issues a state that verifies successfully (round-trip)', () => {
    const service = withEnv({ OAUTH_STATE_SECRET: 'state-secret', OAUTH_STATE_TTL_SEC: '600' });
    const state = service.issue();
    expect(() => service.verify(state)).not.toThrow();
  });

  it('rejects a tampered signature', () => {
    const service = withEnv({ OAUTH_STATE_SECRET: 'state-secret' });
    const state = service.issue();
    const tampered = `${state.slice(0, -1)}${state.endsWith('A') ? 'B' : 'A'}`;
    expect(() => service.verify(tampered)).toThrow(OAuthStateError);
  });

  it('rejects a state signed with a different secret', () => {
    const issuer = withEnv({ OAUTH_STATE_SECRET: 'secret-one' });
    const state = issuer.issue();
    const verifier = withEnv({ OAUTH_STATE_SECRET: 'secret-two' });
    expect(() => verifier.verify(state)).toThrow('invalid state signature');
  });

  it('rejects an expired state', () => {
    const service = withEnv({ OAUTH_STATE_SECRET: 'state-secret', OAUTH_STATE_TTL_SEC: '-1' });
    const state = service.issue();
    expect(() => service.verify(state)).toThrow('state expired');
  });

  it('rejects empty and malformed states', () => {
    const service = withEnv({ OAUTH_STATE_SECRET: 'state-secret' });
    expect(() => service.verify('')).toThrow('state is required');
    expect(() => service.verify('no-dot-separator')).toThrow('malformed state');
  });

  it('falls back to JWT_ACCESS_SECRET in dev with a warning', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = withEnv({
      OAUTH_STATE_SECRET: undefined,
      JWT_ACCESS_SECRET: 'jwt-secret',
      NODE_ENV: 'development',
    });
    const state = service.issue();
    expect(() => service.verify(state)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('только для разработки'),
    );
  });

  it('fails fast in production when OAUTH_STATE_SECRET is missing', () => {
    const service = withEnv({
      OAUTH_STATE_SECRET: undefined,
      JWT_ACCESS_SECRET: 'jwt-secret',
      NODE_ENV: 'production',
    });
    expect(() => service.issue()).toThrow('OAUTH_STATE_SECRET is required in production');
  });
});
