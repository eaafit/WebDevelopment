import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserRole } from '@notary-portal/ui';
import { AuthService } from '../auth.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  private getValidationError(): string | null {
    if (!this.fullName.trim()) return 'Укажите ФИО.';
    if (!EMAIL_RE.test(this.email.trim())) return 'Укажите корректный email.';
    if (!this.phoneNumber.trim()) return 'Укажите номер телефона.';
    if (this.password.length < 8) return 'Пароль должен быть не короче 8 символов.';
    if (this.password !== this.confirmPassword) return 'Пароли должны совпадать.';
    if (!this.termsAccepted) return 'Подтвердите согласие с условиями.';
    return null;
  }
}
