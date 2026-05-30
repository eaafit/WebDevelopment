import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { WebLoggerService } from '@notary-portal/ui';
import { AuthService } from '../auth.service';
import { ResetPassword } from './reset-password';

describe('ResetPassword', () => {
  let component: ResetPassword;
  let fixture: ComponentFixture<ResetPassword>;
  let resetPassword: jest.MockedFunction<AuthService['resetPassword']>;
  let logger: { warn: jest.Mock };

  beforeEach(async () => {
    resetPassword = jest.fn().mockResolvedValue(undefined);
    logger = { warn: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ token: 'reset-token' }),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            loading: signal(false).asReadonly(),
            error: signal<string | null>(null).asReadonly(),
            resetPassword,
          },
        },
        {
          provide: WebLoggerService,
          useValue: logger,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPassword);
    component = fixture.componentInstance;
    jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should toggle new password and confirmation visibility independently', () => {
    const root = fixture.nativeElement as HTMLElement;
    const newPasswordInput = root.querySelector<HTMLInputElement>('#pw');
    const confirmPasswordInput = root.querySelector<HTMLInputElement>('#pw2');
    const buttons = root.querySelectorAll<HTMLButtonElement>('.login__password-toggle');

    expect(newPasswordInput?.type).toBe('password');
    expect(confirmPasswordInput?.type).toBe('password');

    buttons[0]?.click();
    fixture.detectChanges();

    expect(newPasswordInput?.type).toBe('text');
    expect(confirmPasswordInput?.type).toBe('password');

    buttons[1]?.click();
    fixture.detectChanges();

    expect(newPasswordInput?.type).toBe('text');
    expect(confirmPasswordInput?.type).toBe('text');
  });

  it('should not submit a password shorter than 8 characters', async () => {
    component.newPassword = 'short';
    component.confirmPassword = 'short';

    await component.onSubmit();

    expect(resetPassword).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'auth.password_reset.submit.validation_failed',
      expect.objectContaining({
        reason: 'weak_password',
        outcome: 'failed',
      }),
    );
  });

  it('should not submit when passwords do not match', async () => {
    component.newPassword = 'Password123';
    component.confirmPassword = 'Password124';

    await component.onSubmit();

    expect(resetPassword).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'auth.password_reset.submit.validation_failed',
      expect.objectContaining({
        reason: 'password_mismatch',
        outcome: 'failed',
      }),
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('Password123');
  });

  it('should submit a valid reset password request', async () => {
    component.newPassword = 'Password123';
    component.confirmPassword = 'Password123';

    await component.onSubmit();

    expect(resetPassword).toHaveBeenCalledWith('reset-token', 'Password123');
  });
});
