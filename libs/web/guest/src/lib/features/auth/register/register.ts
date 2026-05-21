import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserRole } from '@notary-portal/ui';
import { AuthService } from '../auth.service';

const FULL_NAME_RE = /^[A-Za-zА-Яа-яЁё]{2,}(?:[ -][A-Za-zА-Яа-яЁё]{2,}){1,3}$/u;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_RE = /^(?:\+7|8)\s?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/;

@Component({
  selector: 'lib-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: '../login/login.scss',
})
export class Register {
  private readonly authService = inject(AuthService);

  readonly UserRole = UserRole;
  readonly loading = this.authService.loading;
  readonly error = this.authService.error;
  readonly submitted = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  fullName = '';
  email = '';
  phoneNumber = '';
  password = '';
  confirmPassword = '';
  role = UserRole.Applicant;
  termsAccepted = false;

  get validationError(): string | null {
    if (!this.submitted()) return null;
    return this.getValidationError();
  }

  async onSubmit(): Promise<void> {
    this.submitted.set(true);
    if (this.getValidationError()) return;

    await this.authService.register({
      fullName: this.fullName.trim(),
      email: this.email.trim(),
      phoneNumber: this.phoneNumber.trim(),
      password: this.password,
      role: this.role,
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((value) => !value);
  }

  private getValidationError(): string | null {
    const fullName = this.fullName.trim();
    const email = this.email.trim();
    const phoneNumber = this.phoneNumber.trim();

    if (!FULL_NAME_RE.test(fullName)) return 'Укажите корректное ФИО.';
    if (!EMAIL_RE.test(email)) return 'Укажите корректный email.';
    if (!PHONE_RE.test(phoneNumber)) return 'Укажите корректный номер телефона.';
    if (this.password.length < 8) return 'Пароль должен быть не короче 8 символов.';
    if (this.password !== this.confirmPassword) return 'Пароли должны совпадать.';
    if (!this.termsAccepted) return 'Подтвердите согласие с условиями.';
    return null;
  }
}
