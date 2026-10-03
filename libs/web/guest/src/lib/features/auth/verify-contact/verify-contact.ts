import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

/** Срок кулдауна повторной отправки кода (UX; на бэке отдельная защита). */
const RESEND_COOLDOWN_SEC = 60;

/**
 * Форма подтверждения контакта после OAuth-регистрации/первой связки.
 * Код берётся из лога api (dev-мейлер). На успехе AuthService сам логинит и редиректит.
 */
@Component({
  selector: 'lib-verify-contact',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './verify-contact.html',
  styleUrl: '../login/login.scss',
})
export class VerifyContact implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);

  readonly loading = this.authService.loading;
  readonly error = this.authService.error;
  readonly pending = signal(this.authService.getPendingVerification());
  readonly resendCountdown = signal(0);

  code = '';
  private timer: ReturnType<typeof setInterval> | null = null;

  get contact(): string {
    return this.pending()?.contact ?? '';
  }

  ngOnInit(): void {
    // Код уже отправлен на этапе регистрации/связки — сразу запускаем кулдаун.
    if (this.pending()) this.startCooldown();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  async onSubmit(): Promise<void> {
    const code = this.code.trim();
    if (!/^\d{6}$/.test(code)) return;
    // На успехе AuthService редиректит по роли; на ошибке сообщение в error().
    await this.authService.confirmContact(code);
  }

  async onResend(): Promise<void> {
    if (this.resendCountdown() > 0 || this.loading()) return;
    const ok = await this.authService.resendContactCode();
    if (ok) {
      this.code = '';
      this.startCooldown();
    }
  }

  private startCooldown(): void {
    this.stopTimer();
    this.resendCountdown.set(RESEND_COOLDOWN_SEC);
    this.timer = setInterval(() => {
      this.resendCountdown.update((v) => (v <= 1 ? 0 : v - 1));
      if (this.resendCountdown() === 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
