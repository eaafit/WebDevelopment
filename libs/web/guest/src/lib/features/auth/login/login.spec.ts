import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth.service';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let login: jest.Mock;
  let getAuthorizeUrl: jest.Mock;

  beforeEach(async () => {
    login = jest.fn();
    getAuthorizeUrl = jest.fn();

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            loading: signal(false).asReadonly(),
            error: signal<string | null>(null).asReadonly(),
            login,
            getAuthorizeUrl,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose a single working forgot-password link', () => {
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const links = root.querySelectorAll<HTMLAnchorElement>('[data-testid="forgot-password-link"]');
    const link = links[0] as HTMLAnchorElement | undefined;

    expect(links.length).toBe(1);
    expect(link?.getAttribute('href')).toContain('/auth/forgot-password');
  });

  it('should render Google and Yandex login buttons and start the OAuth redirect on click', async () => {
    getAuthorizeUrl.mockResolvedValue('https://google/auth?x=1');
    const redirect = jest
      .spyOn(component as unknown as { redirectToProvider: (u: string) => void }, 'redirectToProvider')
      .mockImplementation(() => undefined);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="google-login"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="yandex-login"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="vk-login"]')).not.toBeNull();

    await component.onOAuthLogin('google');

    expect(getAuthorizeUrl).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'google' }),
    );
    expect(redirect).toHaveBeenCalledWith('https://google/auth?x=1');
  });

  it('should start the Yandex OAuth redirect on click', async () => {
    getAuthorizeUrl.mockResolvedValue('https://ya/auth?x=1');
    const redirect = jest
      .spyOn(component as unknown as { redirectToProvider: (u: string) => void }, 'redirectToProvider')
      .mockImplementation(() => undefined);

    await component.onOAuthLogin('yandex');

    expect(getAuthorizeUrl).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'yandex' }),
    );
    expect(redirect).toHaveBeenCalledWith('https://ya/auth?x=1');
  });

  it('should expose the register link', () => {
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const link = root.querySelector<HTMLAnchorElement>(
      '[data-testid="register-link"]',
    );

    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('/auth/register');
  });

  it('should toggle password visibility', () => {
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('#password');
    const button = root.querySelector<HTMLButtonElement>(
      '.login__password-toggle',
    );

    expect(input?.type).toBe('password');

    button?.click();
    fixture.detectChanges();

    expect(input?.type).toBe('text');

    button?.click();
    fixture.detectChanges();

    expect(input?.type).toBe('password');
  });

  it('should not submit an invalid email', async () => {
    component.email = 'not-an-email';
    component.password = 'Password123';

    await component.onLogin();

    expect(login).not.toHaveBeenCalled();
    expect(component.validationError()).toBe('Укажите корректный email.');
  });

  it('should fill the form and mark credentials as copied', async () => {
    jest.useFakeTimers();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });

    const account = component.testAccounts[1];
    await component.onUseTestAccount(account);

    expect(component.email).toBe(account.email);
    expect(component.password).toBe(account.password);
    expect(writeText).toHaveBeenCalledWith(`${account.email} / ${account.password}`);
    expect(component.copiedAccount()).toBe(account.email);

    jest.runAllTimers();
    expect(component.copiedAccount()).toBeNull();
    jest.useRealTimers();
  });

  it('should submit trimmed email and password', async () => {
    component.email = ' user@example.com ';
    component.password = 'Password123';

    await component.onLogin();

    expect(login).toHaveBeenCalledWith('user@example.com', 'Password123');
    expect(component.validationError()).toBeNull();
  });
});
