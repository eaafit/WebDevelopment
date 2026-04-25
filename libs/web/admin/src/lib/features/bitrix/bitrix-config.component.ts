import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BitrixService } from '@notary-portal/api-contracts';
import { createClient } from '@connectrpc/connect';
import { RPC_TRANSPORT } from '@notary-portal/ui';

@Component({
  selector: 'lib-bitrix-config',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './bitrix-config.component.html',
  styleUrl: './bitrix-config.component.scss',
})
export class BitrixConfigComponent implements OnInit {
  private readonly client = createClient(BitrixService, inject(RPC_TRANSPORT));

  portalUrl = '';
  memberId = '';
  accessToken = '';
  isActive = false;

  isLoading = false;
  isTesting = false;
  isSaving = false;

  connectionStatus: 'unknown' | 'success' | 'error' = 'unknown';
  connectionMessage = '';

  constructor(private readonly snackBar: MatSnackBar) {}

  async ngOnInit(): Promise<void> {
    await this.loadConfig();
  }

  async loadConfig(): Promise<void> {
    this.isLoading = true;
    try {
      const response = await this.client.getBitrixConfig({});
      const config = response.config;
      if (!config) {
        this.showError('Конфигурация Bitrix не найдена');
        return;
      }

      this.portalUrl = config.portalUrl || '';
      this.memberId = config.memberId || '';
      this.accessToken = config.accessToken || '';
      this.isActive = config.isActive || false;

      this.connectionStatus = 'unknown';
      this.connectionMessage = '';
    } catch (error) {
      console.error('Failed to load Bitrix config:', error);
      this.showError('Не удалось загрузить конфигурацию Bitrix');
    } finally {
      this.isLoading = false;
    }
  }

  async testConnection(): Promise<void> {
    if (!this.portalUrl || !this.memberId || !this.accessToken) {
      this.showError('Заполните все поля для проверки подключения');
      return;
    }

    this.isTesting = true;
    this.connectionStatus = 'unknown';
    this.connectionMessage = 'Проверка подключения...';

    try {
      // Сначала сохраняем конфигурацию
      await this.saveConfig(false);

      // Затем тестируем подключение
      const response = await this.client.testBitrixConnection({});

      if (response.success) {
        this.connectionStatus = 'success';
        this.connectionMessage = 'Подключение успешно установлено';
        this.showSuccess('Подключение к Bitrix успешно проверено');
      } else {
        this.connectionStatus = 'error';
        this.connectionMessage = response.message || 'Ошибка подключения';
        this.showError(`Ошибка подключения: ${response.message}`);
      }
    } catch (error) {
      this.connectionStatus = 'error';
      this.connectionMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      this.showError('Не удалось проверить подключение');
      console.error('Connection test failed:', error);
    } finally {
      this.isTesting = false;
    }
  }

  async saveConfig(showMessage = true): Promise<void> {
    if (!this.portalUrl || !this.memberId || !this.accessToken) {
      this.showError('Заполните все обязательные поля');
      return;
    }

    this.isSaving = true;
    try {
      await this.client.updateBitrixConfig({
        portalUrl: this.portalUrl,
        memberId: this.memberId,
        accessToken: this.accessToken,
        isActive: this.isActive,
      });

      if (showMessage) {
        this.showSuccess('Конфигурация Bitrix успешно сохранена');
      }
    } catch (error) {
      console.error('Failed to save Bitrix config:', error);
      this.showError('Не удалось сохранить конфигурацию Bitrix');
    } finally {
      this.isSaving = false;
    }
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 3000,
      panelClass: ['success-snackbar'],
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 5000,
      panelClass: ['error-snackbar'],
    });
  }

  getConnectionStatusClass(): string {
    switch (this.connectionStatus) {
      case 'success':
        return 'status-success';
      case 'error':
        return 'status-error';
      default:
        return 'status-unknown';
    }
  }

  getConnectionStatusIcon(): string {
    switch (this.connectionStatus) {
      case 'success':
        return 'check_circle';
      case 'error':
        return 'error';
      default:
        return 'help';
    }
  }
}
