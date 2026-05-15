import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InAppNotificationsApiService } from '../rpc/in-app-notifications-api.service';
import { mapRpcNotificationToUi, relativeTimeFrom } from './notification-mapper';
import type { UiInAppNotification } from './notification.models';

@Component({
  selector: 'lib-notification-bell',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
})
export class NotificationBell implements OnInit, OnDestroy {
  readonly notificationsRoute = input('notifications');

  private readonly notificationsApi = inject(InAppNotificationsApiService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly open = signal(false);
  protected readonly unreadCount = signal(0);
  protected readonly preview = signal<UiInAppNotification[]>([]);

  async ngOnInit(): Promise<void> {
    await this.refresh();
    this.refreshTimer = setInterval(() => {
      void this.refresh();
    }, 30_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  protected toggle(): void {
    this.open.update((value) => !value);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected relativeTime(date: Date): string {
    return relativeTimeFrom(date);
  }

  private async refresh(): Promise<void> {
    const { notifications, unreadCount } = await this.notificationsApi.listRecent(5);
    this.preview.set(notifications.map((item) => mapRpcNotificationToUi(item)));
    this.unreadCount.set(unreadCount);
  }
}
