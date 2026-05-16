import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth.service';
import { PasswordRecovery } from './password-recovery';

describe('PasswordRecovery', () => {
  let component: PasswordRecovery;
  let fixture: ComponentFixture<PasswordRecovery>;
  let forgotPassword: jest.MockedFunction<(email: string) => Promise<void>>;
  let errorSignal = signal<string | null>(null);

  beforeEach(async () => {
    forgotPassword = jest.fn().mockResolvedValue(undefined);
    errorSignal = signal<string | null>(null);

    await TestBed.configureTestingModule({
      imports: [PasswordRecovery],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            loading: signal(false).asReadonly(),
            error: errorSignal.asReadonly(),
            forgotPassword,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordRecovery);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should submit email and show success state', async () => {
    component.email = ' user@example.com ';

    await component.onSubmit();
    fixture.detectChanges();

    expect(forgotPassword).toHaveBeenCalledWith('user@example.com');
    expect(component.done()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('мы отправили ссылку');
  });

  it('should render the error from auth service', () => {
    errorSignal.set('Не удалось отправить письмо');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Не удалось отправить письмо');
  });
});
