import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { BitrixService, type SyncLogEntry } from '@notary-portal/api-contracts';
import { createClient } from '@connectrpc/connect';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { interval, Subscription } from 'rxjs';

interface SyncStatus {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalUsers: number;
  processedUsers: number;
  successfulSyncs: number;
  failedSyncs: number;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

interface SyncLog {
  userId: string;
  bitrixContactId?: string;
  action: 'created' | 'updated' | 'skipped' | 'error';
  status: 'success' | 'error';
  message?: string;
  timestamp: Date;
}

@Component({
  selector: 'lib-bitrix-sync',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatPaginatorModule,
  ],
  templateUrl: './bitrix-sync.component.html',
  styleUrl: './bitrix-sync.component.scss',
})
export class BitrixSyncComponent implements OnInit, OnDestroy {
  private readonly client = createClient(BitrixService, inject(RPC_TRANSPORT));
  private statusPollingSubscription?: Subscription;

  currentSyncStatus?: SyncStatus;
  syncLogs: SyncLog[] = [];
  totalLogs = 0;
  pageSize = 10;
  currentPage = 0;

  isStartingSync = false;
  isLoadingLogs = false;
  isPolling = false;

  displayedColumns: string[] = ['timestamp', 'userId', 'action', 'status', 'message'];

  private readonly snackBar = inject(MatSnackBar);

  async ngOnInit(): Promise<void> {
    await this.loadRecentLogs();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  async startSync(forceResync = false): Promise<void> {
    this.isStartingSync = true;
    try {
      const response = await this.client.syncUsersWithBitrix({
        forceResync,
      });

      if (response.status === 'started') {
        this.showSuccess('Синхронизация запущена');
        this.startPolling(response.jobId);
      } else if (response.status === 'already_running') {
        this.showInfo('Синхронизация уже выполняется');
        // Если уже выполняется, начинаем опрос
        this.startPolling(response.jobId);
      } else {
        this.showError(`Ошибка: ${response.message}`);
      }
    } catch (error) {
      console.error('Failed to start sync:', error);
      this.showError('Не удалось запустить синхронизацию');
    } finally {
      this.isStartingSync = false;
    }
  }

  async loadSyncStatus(jobId: string): Promise<void> {
    try {
      const response = await this.client.getSyncStatus({ jobId });
      const s = response.status;
      if (!s) {
        return;
      }
      this.currentSyncStatus = {
        jobId: s.jobId,
        status: s.status as SyncStatus['status'],
        totalUsers: s.totalUsers,
        processedUsers: s.processedUsers,
        successfulSyncs: s.successfulSyncs,
        failedSyncs: s.failedSyncs,
        startedAt: s.startedAt ? timestampDate(s.startedAt) : new Date(0),
        completedAt: s.completedAt ? timestampDate(s.completedAt) : undefined,
        errorMessage: s.errorMessage,
      };

      // Если синхронизация завершена, останавливаем опрос
      if (
        this.currentSyncStatus.status === 'completed' ||
        this.currentSyncStatus.status === 'failed'
      ) {
        this.stopPolling();
        await this.loadRecentLogs();
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
      this.stopPolling();
    }
  }

  async loadRecentLogs(): Promise<void> {
    this.isLoadingLogs = true;
    try {
      const response = await this.client.getSyncLogs({
        pagination: {
          page: this.currentPage + 1,
          limit: this.pageSize,
        },
      });

      this.syncLogs = response.logs.map((log: SyncLogEntry) => ({
        userId: log.userId,
        bitrixContactId: log.bitrixContactId,
        action: log.action as SyncLog['action'],
        status: log.status as SyncLog['status'],
        message: log.message,
        timestamp: log.timestamp ? timestampDate(log.timestamp) : new Date(0),
      }));
      this.totalLogs = response.meta?.totalItems ?? 0;
    } catch (error) {
      console.error('Failed to load sync logs:', error);
      this.showError('Не удалось загрузить логи синхронизации');
    } finally {
      this.isLoadingLogs = false;
    }
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadRecentLogs();
  }

  getProgressPercentage(): number {
    if (!this.currentSyncStatus || this.currentSyncStatus.totalUsers === 0) {
      return 0;
    }
    return (this.currentSyncStatus.processedUsers / this.currentSyncStatus.totalUsers) * 100;
  }

  getStatusText(): string {
    if (!this.currentSyncStatus) {
      return 'Нет активной синхронизации';
    }

    switch (this.currentSyncStatus.status) {
      case 'pending':
        return 'Ожидание запуска';
      case 'running':
        return `Выполняется: ${this.currentSyncStatus.processedUsers} из ${this.currentSyncStatus.totalUsers}`;
      case 'completed':
        return `Завершено: ${this.currentSyncStatus.successfulSyncs} успешно, ${this.currentSyncStatus.failedSyncs} с ошибками`;
      case 'failed':
        return `Ошибка: ${this.currentSyncStatus.errorMessage || 'Неизвестная ошибка'}`;
      default:
        return 'Неизвестный статус';
    }
  }

  getStatusIcon(): string {
    if (!this.currentSyncStatus) {
      return 'sync';
    }

    switch (this.currentSyncStatus.status) {
      case 'pending':
        return 'schedule';
      case 'running':
        return 'sync';
      case 'completed':
        return 'check_circle';
      case 'failed':
        return 'error';
      default:
        return 'help';
    }
  }

  getStatusColor(): string {
    if (!this.currentSyncStatus) {
      return 'primary';
    }

    switch (this.currentSyncStatus.status) {
      case 'pending':
        return 'accent';
      case 'running':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'warn';
      default:
        return 'primary';
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString('ru-RU');
  }

  formatAction(action: string): string {
    const actions: Record<string, string> = {
      created: 'Создан',
      updated: 'Обновлён',
      skipped: 'Пропущен',
      error: 'Ошибка',
    };
    return actions[action] || action;
  }

  formatStatus(status: string): string {
    const statuses: Record<string, string> = {
      success: 'Успешно',
      error: 'Ошибка',
    };
    return statuses[status] || status;
  }

  private startPolling(jobId: string): void {
    this.stopPolling();
    this.isPolling = true;

    // Загружаем статус сразу
    this.loadSyncStatus(jobId);

    // Начинаем опрос каждые 3 секунды
    this.statusPollingSubscription = interval(3000).subscribe(() => {
      this.loadSyncStatus(jobId);
    });
  }

  private stopPolling(): void {
    if (this.statusPollingSubscription) {
      this.statusPollingSubscription.unsubscribe();
      this.statusPollingSubscription = undefined;
    }
    this.isPolling = false;
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

  private showInfo(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 3000,
    });
  }
}
