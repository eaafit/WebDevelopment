import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Role, ROLE_LABELS } from '../../../core/auth/role.enum';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  readonly roles = Object.values(Role);
  readonly roleLabels = ROLE_LABELS;
  selectedRole: Role = Role.Guest;

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  onLogin(): void {
    this.authService.login(this.selectedRole);
    if (this.selectedRole === Role.Administrator) {
      this.router.navigate(['/admin']);
    }
  }
}
