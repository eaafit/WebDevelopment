import { TestBed } from '@angular/core/testing';
import { TokenStore, UserRole } from '@notary-portal/ui';

function makeJwt(payload: object): string {
  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64url({ alg: 'HS256' })}.${b64url(payload)}.sig`;
}

const NOW   = Math.floor(Date.now() / 1000);
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
    store.setTokens(TOKEN, 'rt', { id: 'u1', email: 'a@b.com', fullName: 'Test', role: 1, phoneNumber: '', isActive: true });
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
