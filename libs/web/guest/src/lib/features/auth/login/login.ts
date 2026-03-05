import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Role, ROLE_LABELS } from '../role.enum';
import { AuthService } from '../auth.service';

const ROLE_HOME: Partial<Record<Role, string>> = {
  [Role.Applicant]: '/applicant',
  [Role.Notary]: '/notary',
  [Role.Administrator]: '/admin',
  [Role.Guest]: '/',
};

@Component({
  selector: 'lib-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  readonly roles = Object.values(Role);
  readonly roleLabels = ROLE_LABELS;
  selectedRole: Role = Role.Guest;

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  onLogin(): void {
    this.authService.login(this.selectedRole);
    const home = ROLE_HOME[this.selectedRole] ?? '/';
    this.router.navigateByUrl(home);
  }
}
