import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Role, ROLE_LABELS } from '../../../core/auth/role.enum';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  readonly roles = Object.values(Role);
  readonly roleLabels = ROLE_LABELS;
  selectedRole: Role = Role.Guest;

  constructor(private readonly authService: AuthService) {}

  onLogin(): void {
    this.authService.login(this.selectedRole);
  }
}
