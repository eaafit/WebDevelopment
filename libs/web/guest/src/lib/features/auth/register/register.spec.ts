import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UserRole } from '@notary-portal/ui';
import { AuthService } from '../auth.service';
import { Register } from './register';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let register: jest.MockedFunction<AuthService['register']>;
  let errorSignal = signal<string | null>(null);

  beforeEach(async () => {
    register = jest.fn().mockResolvedValue(undefined);
    errorSignal = signal<string | null>(null);

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            loading: signal(false).asReadonly(),
            error: errorSignal.asReadonly(),
            register,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not submit invalid data', async () => {
    await component.onSubmit();

    expect(register).not.toHaveBeenCalled();
    expect(component.validationError).toBe('Укажите ФИО.');
  });

  it('should not submit when passwords do not match', async () => {
    fillValidForm(component);
    component.confirmPassword = 'Different123';

    await component.onSubmit();

    expect(register).not.toHaveBeenCalled();
    expect(component.validationError).toBe('Пароли должны совпадать.');
  });

  it('should call AuthService.register with applicant role', async () => {
    fillValidForm(component);

    await component.onSubmit();

    expect(register).toHaveBeenCalledWith({
      fullName: 'Иванов Иван',
      email: 'ivan@example.com',
      phoneNumber: '+79991234567',
      password: 'Password123',
      role: UserRole.Applicant,
    });
  });

  it('should call AuthService.register with notary role', async () => {
    fillValidForm(component);
    component.role = UserRole.Notary;

    await component.onSubmit();

    expect(register).toHaveBeenCalledWith(expect.objectContaining({ role: UserRole.Notary }));
  });

  it('should render the error from auth service', () => {
    errorSignal.set('email already registered');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('email already registered');
  });
});

function fillValidForm(component: Register): void {
  component.fullName = ' Иванов Иван ';
  component.email = ' ivan@example.com ';
  component.phoneNumber = ' +79991234567 ';
  component.password = 'Password123';
  component.confirmPassword = 'Password123';
  component.termsAccepted = true;
}
