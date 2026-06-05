import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService, resolveOAuthProvider } from '../auth.service';

/**
 * Точка приземления OAuth-редиректа провайдера (redirect_uri).
 * Провайдер берётся из параметра маршрута /auth/oauth/:provider/callback.
 * Читает code/state из query, передаёт в AuthService.completeOAuthLogin,
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
    const config = resolveOAuthProvider(this.route.snapshot.paramMap.get('provider'));
    const params = this.route.snapshot.queryParamMap;

    // Неизвестный провайдер или провайдер вернул ошибку (например, отказ в доступе).
    if (!config || params.get('error')) {
      this.failed.set(true);
      return;
    }

    const code = params.get('code') ?? '';
    const state = params.get('state') ?? '';
    const ok = await this.authService.completeOAuthLogin(config, code, state);
    if (!ok) {
      this.failed.set(true);
    }
  }
}
