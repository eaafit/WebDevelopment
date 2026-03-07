import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { Role } from './role.enum';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
    service.logout();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should not be logged in initially', () => {
    expect(service.isLoggedInValue()).toBe(false);
    expect(service.getCurrentRole()).toBeNull();
  });

  it('should be logged in with role after login', () => {
    service.login(Role.Administrator);
    expect(service.isLoggedInValue()).toBe(true);
    expect(service.getCurrentRole()).toBe(Role.Administrator);
    expect(service.hasRole(Role.Administrator)).toBe(true);
    expect(service.hasRole(Role.Guest)).toBe(false);
  });

  it('should clear role after logout', () => {
    service.login(Role.Notary);
    service.logout();
    expect(service.isLoggedInValue()).toBe(false);
    expect(service.getCurrentRole()).toBeNull();
  });
});
