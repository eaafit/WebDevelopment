import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WebLoggerService } from '@notary-portal/ui';
import { AuthService } from '../auth.service';
import { ForgotPassword } from './forgot-password';

describe('ForgotPassword', () => {
  let component: ForgotPassword;
  let fixture: ComponentFixture<ForgotPassword>;
  let forgotPassword: jest.MockedFunction<AuthService['forgotPassword']>;
  let logger: { warn: jest.Mock };

  beforeEach(async () => {
    forgotPassword = jest.fn().mockResolvedValue(undefined);
    logger = { warn: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            loading: signal(false).asReadonly(),
            error: signal<string | null>(null).asReadonly(),
            forgotPassword,
          },
        },
        {
          provide: WebLoggerService,
          useValue: logger,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPassword);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should log invalid email validation without calling AuthService', async () => {
    component.email = 'not-an-email';

    await component.onSubmit();

    expect(forgotPassword).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'auth.password_reset.request.validation_failed',
      expect.objectContaining({
        reason: 'invalid_email',
        outcome: 'failed',
      }),
    );
  });

  it('should submit a valid email and mark the form as done', async () => {
    component.email = ' user@example.com ';

    await component.onSubmit();

    expect(forgotPassword).toHaveBeenCalledWith('user@example.com');
    expect(component.done()).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
