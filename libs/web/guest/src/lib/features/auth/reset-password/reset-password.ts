import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'lib-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: '../login/login.scss',
})
export class ResetPassword implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = this.authService.loading;
  readonly error = this.authService.error;

  token = '';
  newPassword = '';
  confirmPassword = '';
  readonly showNewPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
  }

  async onSubmit(): Promise<void> {
    if (!this.token || this.newPassword.length < 8) return;
    if (this.newPassword !== this.confirmPassword) return;
    try {
      await this.authService.resetPassword(this.token, this.newPassword);
      await this.router.navigateByUrl('/auth');
    } catch {
      /* authService.error */
    }
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword.update((value) => !value);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((value) => !value);
  }
}
