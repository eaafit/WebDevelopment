import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService, type PendingVerification } from '../auth.service';
import { VerifyContact } from './verify-contact';

describe('VerifyContact', () => {
  let getPendingVerification: jest.Mock;
  let confirmContact: jest.Mock;
  let resendContactCode: jest.Mock;

  async function setup(
    pending: PendingVerification | null,
  ): Promise<ComponentFixture<VerifyContact>> {
    getPendingVerification.mockReturnValue(pending);
    await TestBed.configureTestingModule({
      imports: [VerifyContact],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            loading: signal(false).asReadonly(),
            error: signal<string | null>(null).asReadonly(),
            getPendingVerification,
            confirmContact,
            resendContactCode,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VerifyContact);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    getPendingVerification = jest.fn();
    confirmContact = jest.fn().mockResolvedValue(true);
    resendContactCode = jest.fn().mockResolvedValue(true);
  });

  it('shows the contact and submits a 6-digit code to confirmContact', async () => {
    const fixture = await setup({ ticket: 't', contact: 'new@user.com', providerKey: 'google' });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('new@user.com');
    expect(root.querySelector('[data-testid="contact-code"]')).not.toBeNull();

    fixture.componentInstance.code = '123456';
    await fixture.componentInstance.onSubmit();

    expect(confirmContact).toHaveBeenCalledWith('123456');
    fixture.destroy();
  });

  it('ignores a submit when the code is not 6 digits', async () => {
    const fixture = await setup({ ticket: 't', contact: 'a@b.com', providerKey: 'google' });
    fixture.componentInstance.code = '12';
    await fixture.componentInstance.onSubmit();
    expect(confirmContact).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('resends the code and starts the 60s cooldown', async () => {
    const fixture = await setup({ ticket: 't', contact: 'a@b.com', providerKey: 'google' });
    // ngOnInit уже запустил кулдаун — дождёмся и сбросим через повторную отправку.
    fixture.componentInstance.resendCountdown.set(0);

    await fixture.componentInstance.onResend();

    expect(resendContactCode).toHaveBeenCalled();
    expect(fixture.componentInstance.resendCountdown()).toBe(60);
    fixture.destroy();
  });

  it('does not resend while the cooldown is active', async () => {
    const fixture = await setup({ ticket: 't', contact: 'a@b.com', providerKey: 'google' });
    fixture.componentInstance.resendCountdown.set(30);

    await fixture.componentInstance.onResend();

    expect(resendContactCode).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('shows an expired-session message when there is no pending verification', async () => {
    const fixture = await setup(null);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.login__error')).not.toBeNull();
    expect(root.querySelector('[data-testid="contact-code"]')).toBeNull();
    fixture.destroy();
  });
});
