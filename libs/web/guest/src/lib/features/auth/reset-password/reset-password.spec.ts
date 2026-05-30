import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { ResetPassword } from './reset-password';

describe('ResetPassword', () => {
  let component: ResetPassword;
  let fixture: ComponentFixture<ResetPassword>;
  let resetPassword: jest.MockedFunction<AuthService['resetPassword']>;

  beforeEach(async () => {
    resetPassword = jest.fn().mockResolvedValue(undefined);

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
  });

  it('should not submit when passwords do not match', async () => {
    component.newPassword = 'Password123';
    component.confirmPassword = 'Password124';

    await component.onSubmit();

    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('should submit a valid reset password request', async () => {
    component.newPassword = 'Password123';
    component.confirmPassword = 'Password123';

    await component.onSubmit();

    expect(resetPassword).toHaveBeenCalledWith('reset-token', 'Password123');
  });
});
