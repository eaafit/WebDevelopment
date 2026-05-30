import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { AuthService } from '../auth.service';
import { OAuthCallback } from './oauth-callback';

describe('OAuthCallback', () => {
  let completeGoogleLogin: jest.Mock;

  async function setup(query: Record<string, string>): Promise<ComponentFixture<OAuthCallback>> {
    await TestBed.configureTestingModule({
      imports: [OAuthCallback],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            error: signal<string | null>(null).asReadonly(),
            completeGoogleLogin,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OAuthCallback);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    completeGoogleLogin = jest.fn();
  });

  it('passes code and state to completeGoogleLogin and stays in progress on success', async () => {
    completeGoogleLogin.mockResolvedValue(true);
    const fixture = await setup({ code: 'auth-code', state: 'st-1' });

    expect(completeGoogleLogin).toHaveBeenCalledWith('auth-code', 'st-1');
    expect(fixture.componentInstance.failed()).toBe(false);
  });

  it('marks failure when login does not succeed', async () => {
    completeGoogleLogin.mockResolvedValue(false);
    const fixture = await setup({ code: 'auth-code', state: 'st-1' });

    expect(fixture.componentInstance.failed()).toBe(true);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.login__error')).not.toBeNull();
  });

  it('marks failure and skips the backend when the provider returns an error', async () => {
    const fixture = await setup({ error: 'access_denied' });

    expect(completeGoogleLogin).not.toHaveBeenCalled();
    expect(fixture.componentInstance.failed()).toBe(true);
  });
});
