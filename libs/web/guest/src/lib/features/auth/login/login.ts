import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { UserRole, ROLE_LABELS } from '../role.enum';

@Component({
  selector: 'lib-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly authService = inject(AuthService);

  readonly loading = this.authService.loading;
  readonly error   = this.authService.error;

  email    = '';
  password = '';

  async onLogin(): Promise<void> {
    if (!this.email || !this.password) return;
    await this.authService.login(this.email, this.password);
  }
}
