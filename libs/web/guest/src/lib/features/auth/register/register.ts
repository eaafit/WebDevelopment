import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserRole, WebLoggerService } from '@notary-portal/ui';
import { AuthService } from '../auth.service';
import {
  authRoleName,
  buildAuthLogContext,
  currentBrowserRoute,
  emailDomainOf,
} from '../auth-browser-log';

const FULL_NAME_RE = /^[A-Za-zА-Яа-яЁё]{2,}(?:[ -][A-Za-zА-Яа-яЁё]{2,}){1,3}$/u;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_RE = /^(?:\+7|8)\d{10}$/;
const RUSSIAN_PHONE_DIGIT_LIMIT = 11;

@Component({
  selector: 'lib-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: '../login/login.scss',
})
export class Register {
  private readonly authService = inject(AuthService);
  private readonly logger = inject(WebLoggerService);

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
    const validationError = this.getValidationError();
    if (validationError) {
      this.logValidationFailure(this.getValidationReason());
      return;
    }

    await this.authService.register({
      fullName: this.fullName.trim(),
      email: this.email.trim(),
      phoneNumber: normalizeRussianPhone(this.phoneNumber),
      password: this.password,
      role: this.role,
    });
  }

  onPhoneNumberChange(value: string): void {
    this.phoneNumber = formatRussianPhone(value);
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
    const phoneNumber = normalizeRussianPhone(this.phoneNumber);

    if (!FULL_NAME_RE.test(fullName)) return 'Укажите корректное ФИО.';
    if (!EMAIL_RE.test(email)) return 'Укажите корректный email.';
    if (!PHONE_RE.test(phoneNumber)) return 'Укажите корректный номер телефона.';
    if (this.password.length < 8) return 'Пароль должен быть не короче 8 символов.';
    if (this.password !== this.confirmPassword) return 'Пароли должны совпадать.';
    if (!this.termsAccepted) return 'Подтвердите согласие с условиями.';
    return null;
  }

  private getValidationReason(): string {
    const fullName = this.fullName.trim();
    const email = this.email.trim();
    const phoneNumber = normalizeRussianPhone(this.phoneNumber);

    if (!FULL_NAME_RE.test(fullName)) return 'invalid_full_name';
    if (!EMAIL_RE.test(email)) return 'invalid_email';
    if (!PHONE_RE.test(phoneNumber)) return 'invalid_phone';
    if (this.password.length < 8) return 'weak_password';
    if (this.password !== this.confirmPassword) return 'password_mismatch';
    if (!this.termsAccepted) return 'terms_required';
    return 'invalid_form';
  }

  private logValidationFailure(reason: string): void {
    this.logger.warn(
      'auth.register.validation_failed',
      buildAuthLogContext({
        emailDomain: emailDomainOf(this.email),
        role: authRoleName(this.role),
        reason,
        route: currentBrowserRoute(),
        outcome: 'failed',
      }),
    );
  }
}

function formatRussianPhone(value: string): string {
  const raw = value.trim();
  const digits = getLimitedPhoneDigits(value);
  if (!digits) return raw.startsWith('+') ? '+' : '';

  if (digits.startsWith('7')) {
    return formatRussianPhoneParts('+7', digits.slice(1));
  }

  if (!raw.startsWith('+') && digits.startsWith('8')) {
    return formatRussianPhoneParts('8', digits.slice(1));
  }

  return digits;
}

function normalizeRussianPhone(value: string): string {
  const digits = getLimitedPhoneDigits(value);

  if (!digits) return '';
  if (digits.length !== RUSSIAN_PHONE_DIGIT_LIMIT) return digits;
  if (digits.startsWith('8')) return digits;
  if (digits.startsWith('7')) return `+${digits}`;

  return digits;
}

function getLimitedPhoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, RUSSIAN_PHONE_DIGIT_LIMIT);
}

function formatRussianPhoneParts(prefix: '+7' | '8', nationalNumber: string): string {
  if (!nationalNumber) return prefix;

  let formatted = `${prefix} (${nationalNumber.slice(0, 3)}`;
  if (nationalNumber.length >= 3) formatted += ')';
  if (nationalNumber.length > 3) formatted += ` ${nationalNumber.slice(3, 6)}`;
  if (nationalNumber.length > 6) formatted += `-${nationalNumber.slice(6, 8)}`;
  if (nationalNumber.length > 8) formatted += `-${nationalNumber.slice(8, 10)}`;

  return formatted;
}
