import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InAppNotificationsApiService } from '../rpc/in-app-notifications-api.service';
import { WebLoggerService } from '../logging/web-logger.service';
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
  private readonly logger = inject(WebLoggerService);

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

  protected async markAsRead(item: UiInAppNotification): Promise<void> {
    if (!item.isUnread) {
      return;
    }

    this.logger.info('notification.bell.mark_as_read_started', {
      notificationId: item.id,
    });

    try {
      await this.notificationsApi.markAsRead(item.id);
      this.preview.update((items) => items.filter((current) => current.id !== item.id));
      this.counter.markOneAsRead();
      this.logger.info('notification.bell.mark_as_read_succeeded', {
        notificationId: item.id,
      });
    } catch (error) {
      this.logger.error('notification.bell.mark_as_read_failed', {
        notificationId: item.id,
        error,
      });
    }
  }

  protected relativeTime(date: Date): string {
    return relativeTimeFrom(date);
  }

  private async refreshPreview(): Promise<void> {
    this.logger.info('notification.bell.preview_load_started');

    try {
      const { notifications } = await this.notificationsApi.listRecent(5);
      this.preview.set(notifications.map((item) => mapRpcNotificationToUi(item)));
      this.logger.info('notification.bell.preview_load_succeeded', {
        count: notifications.length,
      });
    } catch (error) {
      this.preview.set([]);
      this.logger.error('notification.bell.preview_load_failed', { error });
    }
  }
}
