import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth.service';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let login: jest.Mock;

  beforeEach(async () => {
    login = jest.fn();

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

    const links = fixture.nativeElement.querySelectorAll('[data-testid="forgot-password-link"]');
    const link = links[0] as HTMLAnchorElement | undefined;

    expect(links.length).toBe(1);
    expect(link?.getAttribute('href')).toContain('/auth/forgot-password');
  });

  it('should expose the register link', () => {
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('[data-testid="register-link"]') as HTMLAnchorElement | null;

    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('/auth/register');
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
  });
});
