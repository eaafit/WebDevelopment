import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AuthService } from '../auth.service';
import { PasswordRecoveryReset } from './password-recovery-reset';

describe('PasswordRecoveryReset', () => {
  let component: PasswordRecoveryReset;
  let fixture: ComponentFixture<PasswordRecoveryReset>;
  let resetPassword: jest.MockedFunction<(token: string, newPassword: string) => Promise<void>>;
  let router: Router;

  beforeEach(async () => {
    resetPassword = jest.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [PasswordRecoveryReset],
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

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(PasswordRecoveryReset);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should read token from query params', () => {
    expect(component.token).toBe('reset-token');
  });

  it('should not submit when token is missing', async () => {
    component.token = '';
    component.newPassword = 'Password123';
    component.confirmPassword = 'Password123';

    await component.onSubmit();

    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('should not submit when passwords do not match', async () => {
    component.newPassword = 'Password123';
    component.confirmPassword = 'Password456';

    await component.onSubmit();

    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('should submit new password and navigate to auth page', async () => {
    component.newPassword = 'Password123';
    component.confirmPassword = 'Password123';

    await component.onSubmit();

    expect(resetPassword).toHaveBeenCalledWith('reset-token', 'Password123');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/auth');
  });
});
