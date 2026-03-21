import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';

interface TestAccount {
  role: string;
  email: string;
  password: string;
}

@Component({
  selector: 'lib-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly authService = inject(AuthService);
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  readonly loading = this.authService.loading;
  readonly error = this.authService.error;
  readonly copiedAccount = signal<string | null>(null);
  readonly testAccounts: TestAccount[] = [
    { role: 'Applicant', email: 'seed-user-000@seed.local', password: 'SeedPass123!' },
    { role: 'Notary', email: 'seed-user-010@seed.local', password: 'SeedPass123!' },
    { role: 'Admin', email: 'seed-user-020@seed.local', password: 'SeedPass123!' },
  ];

  email = '';
  password = '';

  async onLogin(): Promise<void> {
    if (!this.email || !this.password) return;
    await this.authService.login(this.email, this.password);
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
