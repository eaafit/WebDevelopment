import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WebLoggerService } from '@notary-portal/ui';
import { AuthService } from '../auth.service';
import { buildAuthLogContext, currentBrowserRoute, emailDomainOf } from '../auth-browser-log';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'lib-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: '../login/login.scss',
})
export class ForgotPassword {
  private readonly authService = inject(AuthService);
  private readonly logger = inject(WebLoggerService);

  readonly loading = this.authService.loading;
  readonly error = this.authService.error;
  readonly done = signal(false);
  readonly validationError = signal<string | null>(null);

  email = '';

  async onSubmit(): Promise<void> {
    const email = this.email.trim();
    if (!EMAIL_RE.test(email)) {
      this.validationError.set('Укажите корректный email.');
      this.logValidationFailure(email);
      return;
    }

    this.validationError.set(null);

    try {
      await this.authService.forgotPassword(email);
      this.done.set(true);
    } catch {
      /* сообщение в authService.error */
    }
  }

  private logValidationFailure(email: string): void {
    this.logger.warn(
      'auth.password_reset.request.validation_failed',
      buildAuthLogContext({
        emailDomain: emailDomainOf(email),
        reason: 'invalid_email',
        route: currentBrowserRoute(),
        outcome: 'failed',
      }),
    );
  }
}
