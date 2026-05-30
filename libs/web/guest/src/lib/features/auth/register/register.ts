import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserRole } from '@notary-portal/ui';
import { AuthService } from '../auth.service';

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
      phoneNumber: normalizeRussianPhone(this.phoneNumber),
      password: this.password,
      role: this.role,
    });
  }

  onPhoneNumberChange(value: string): void {
    this.phoneNumber = formatRussianPhone(value);
  }

  async onGoogleLogin(): Promise<void> {
    try {
      const url = await this.authService.getGoogleAuthorizeUrl();
      this.redirectToProvider(url);
    } catch {
      // Сообщение об ошибке уже выставлено в authService.error().
    }
  }

  /** Вынесено отдельно для тестируемости (jsdom не выполняет реальную навигацию). */
  protected redirectToProvider(url: string): void {
    if (typeof window !== 'undefined') {
      window.location.assign(url);
    }
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
