import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@notary-portal/guest';

type OAuthProviderType = 'vk' | 'google' | 'apple' | 'yandex';
type UserRoleType = 'notary' | 'applicant';
type UserRole = 'notary' | 'applicant';

@Component({
  selector: 'lib-auth-services',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-services.html',
  styleUrl: './auth-services.scss',
})
export class AuthServices {
  private readonly authService = inject(AuthService);

  selectedRole: UserRole = 'applicant';
  isLoading = false;
  error: string | null = null;

  onRoleChange(role: UserRole): void {
    this.selectedRole = role;
    console.log(`[auth] Role selected: ${role}`);
  }

  async signInWithVk(): Promise<void> {
    await this.handleOAuth('vk');
  }

  async signInWithGoogle(): Promise<void> {
    await this.handleOAuth('google');
  }

  async signInWithApple(): Promise<void> {
    await this.handleOAuth('apple');
  }

  async signInWithYandex(): Promise<void> {
    await this.handleOAuth('yandex');
  }

  private async handleOAuth(provider: OAuthProviderType): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const { authorizationUrl } = await this.authService.initOAuth(provider, this.selectedRole);
      // Редирект на провайдера для авторизации
      window.location.href = authorizationUrl;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Ошибка авторизации';
      console.error('[auth] OAuth error:', err);
    } finally {
      this.isLoading = false;
    }
  }
}
