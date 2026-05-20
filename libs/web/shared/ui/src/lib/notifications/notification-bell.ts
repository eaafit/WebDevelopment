import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InAppNotificationsApiService } from '../rpc/in-app-notifications-api.service';
import { NotificationCounterService } from './notification-counter.service';
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
  private readonly counter = inject(NotificationCounterService);

  protected readonly open = signal(false);
  protected readonly preview = signal<UiInAppNotification[]>([]);

  protected readonly unreadCount = this.counter.unreadCount;

  async ngOnInit(): Promise<void> {
    this.counter.startPolling();
    await this.refreshPreview();
  }

  ngOnDestroy(): void {
    this.counter.stopPolling();
  }

  protected toggle(): void {
    const willOpen = !this.open();
    this.open.set(willOpen);
    if (willOpen) {
      void this.refreshPreview();
    }
  }

  protected close(): void {
    this.open.set(false);
  }

  protected relativeTime(date: Date): string {
    return relativeTimeFrom(date);
  }

  private async refreshPreview(): Promise<void> {
    const { notifications } = await this.notificationsApi.listRecent(5);
    this.preview.set(notifications.map((item) => mapRpcNotificationToUi(item)));
  }
}
