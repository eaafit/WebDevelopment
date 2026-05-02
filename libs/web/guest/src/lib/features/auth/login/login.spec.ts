import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth.service';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            loading: signal(false).asReadonly(),
            error: signal<string | null>(null).asReadonly(),
            login: jest.fn(),
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

  it('should expose the additive email recovery link', () => {
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('[data-testid="email-recovery-link"]') as HTMLAnchorElement | null;

    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('/auth/password-recovery');
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
});
