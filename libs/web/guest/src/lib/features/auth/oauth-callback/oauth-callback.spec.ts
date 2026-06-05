import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { AuthService } from '../auth.service';
import { OAuthCallback } from './oauth-callback';

describe('OAuthCallback', () => {
  let completeOAuthLogin: jest.Mock;

  async function setup(
    query: Record<string, string>,
    provider = 'google',
  ): Promise<ComponentFixture<OAuthCallback>> {
    await TestBed.configureTestingModule({
      imports: [OAuthCallback],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            error: signal<string | null>(null).asReadonly(),
            completeOAuthLogin,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ provider }),
              queryParamMap: convertToParamMap(query),
            },
          },
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
    completeOAuthLogin = jest.fn();
  });

  it('passes the resolved provider, code and state to completeOAuthLogin on success', async () => {
    completeOAuthLogin.mockResolvedValue(true);
    const fixture = await setup({ code: 'auth-code', state: 'st-1' }, 'yandex');

    expect(completeOAuthLogin).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'yandex' }),
      'auth-code',
      'st-1',
      '',
    );
    expect(fixture.componentInstance.failed()).toBe(false);
  });

  it('forwards the VK device_id from the callback query', async () => {
    completeOAuthLogin.mockResolvedValue(true);
    const fixture = await setup(
      { code: 'vk-code', state: 'st-vk', device_id: 'device-9' },
      'vk',
    );

    expect(completeOAuthLogin).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'vk' }),
      'vk-code',
      'st-vk',
      'device-9',
    );
    expect(fixture.componentInstance.failed()).toBe(false);
  });

  it('marks failure when login does not succeed', async () => {
    completeOAuthLogin.mockResolvedValue(false);
    const fixture = await setup({ code: 'auth-code', state: 'st-1' });

    expect(fixture.componentInstance.failed()).toBe(true);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.login__error')).not.toBeNull();
  });

  it('marks failure and skips the backend when the provider returns an error', async () => {
    const fixture = await setup({ error: 'access_denied' });

    expect(completeOAuthLogin).not.toHaveBeenCalled();
    expect(fixture.componentInstance.failed()).toBe(true);
  });

  it('marks failure for an unknown provider in the route', async () => {
    const fixture = await setup({ code: 'c', state: 's' }, 'unknown');

    expect(completeOAuthLogin).not.toHaveBeenCalled();
    expect(fixture.componentInstance.failed()).toBe(true);
  });
});
