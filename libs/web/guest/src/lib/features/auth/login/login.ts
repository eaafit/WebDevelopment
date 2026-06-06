import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WebLoggerService } from '@notary-portal/ui';
import { AuthService } from '../auth.service';
import { buildAuthLogContext, currentBrowserRoute, emailDomainOf } from '../auth-browser-log';
import { isNgAppShowTestAccountsEnabled } from './ng-app-flags';

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

interface TestAccount {
  role: string;
  email: string;
  password: string;
}

@Component({
  selector: 'lib-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly logger = inject(WebLoggerService);
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  /** Off by default; set `NG_APP_SHOW_TEST_ACCOUNTS=true` at web image build (or `nx serve` dev config) to show test-account UI. */
  protected readonly showTestAccountHints = isNgAppShowTestAccountsEnabled();

  readonly loading = this.authService.loading;
  readonly error = this.authService.error;
  readonly copiedAccount = signal<string | null>(null);
  readonly validationError = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly testAccounts: TestAccount[] = [
    { role: 'Applicant', email: 'seed-user-000@seed.local', password: 'SeedPass123!' },
    { role: 'Notary', email: 'seed-user-010@seed.local', password: 'SeedPass123!' },
    { role: 'Admin', email: 'seed-user-020@seed.local', password: 'SeedPass123!' },
  ];

  email = '';
  password = '';

  async onLogin(): Promise<void> {
    const email = this.email.trim();
    if (!EMAIL_RE.test(email)) {
      this.validationError.set('Укажите корректный email.');
      this.logValidationFailure('invalid_email', email);
      return;
    }
    if (!this.password) {
      this.validationError.set('Укажите пароль.');
      this.logValidationFailure('password_required', email);
      return;
    }

    this.validationError.set(null);
    await this.authService.login(email, this.password);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  async onUseTestAccount(account: TestAccount): Promise<void> {
    this.email = account.email;
    this.password = account.password;

    const payload = `${account.email} / ${account.password}`;
    await copyText(payload);

    this.copiedAccount.set(account.email);
    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer);
    }
    this.copyResetTimer = setTimeout(() => this.copiedAccount.set(null), 2000);
  }

  private logValidationFailure(reason: string, email: string): void {
    this.logger.warn(
      'auth.login.validation_failed',
      buildAuthLogContext({
        emailDomain: emailDomainOf(email),
        reason,
        route: currentBrowserRoute(),
        outcome: 'failed',
      }),
    );
  }
}

async function copyText(value: string): Promise<void> {
  if (globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
