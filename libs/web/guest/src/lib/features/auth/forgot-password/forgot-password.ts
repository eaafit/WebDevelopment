import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'lib-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: '../login/login.scss',
})
export class ForgotPassword {
  private readonly authService = inject(AuthService);

  readonly loading = this.authService.loading;
  readonly error = this.authService.error;
  readonly done = signal(false);

  email = '';

  async onSubmit(): Promise<void> {
    if (!this.email.trim()) return;
    try {
      await this.authService.forgotPassword(this.email);
      this.done.set(true);
    } catch {
      /* сообщение в authService.error */
    }
  }
}
