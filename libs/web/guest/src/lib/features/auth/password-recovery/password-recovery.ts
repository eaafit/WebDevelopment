import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'lib-password-recovery',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './password-recovery.html',
  styleUrl: '../login/login.scss',
})
export class PasswordRecovery {
  private readonly authService = inject(AuthService);

  readonly loading = this.authService.loading;
  readonly error = this.authService.error;
  readonly done = signal(false);

  email = '';

  async onSubmit(): Promise<void> {
    const email = this.email.trim();
    if (!email) return;

    try {
      await this.authService.forgotPassword(email);
      this.done.set(true);
    } catch {
      /* authService.error */
    }
  }
}
