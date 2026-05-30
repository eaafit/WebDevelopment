import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

/**
 * Точка приземления OAuth-редиректа провайдера (redirect_uri).
 * Читает code/state из query, передаёт в AuthService.completeGoogleLogin,
 * который на успехе сам логинит и редиректит по роли.
 */
@Component({
  selector: 'lib-oauth-callback',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './oauth-callback.html',
  styleUrl: '../login/login.scss',
})
export class OAuthCallback implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  readonly error = this.authService.error;
  readonly failed = signal(false);

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;

    // Провайдер вернул ошибку (например, пользователь отклонил доступ).
    if (params.get('error')) {
      this.failed.set(true);
      return;
    }

    const code = params.get('code') ?? '';
    const state = params.get('state') ?? '';
    const ok = await this.authService.completeGoogleLogin(code, state);
    if (!ok) {
      this.failed.set(true);
    }
  }
}
