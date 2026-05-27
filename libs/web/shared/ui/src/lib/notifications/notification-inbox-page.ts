import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { NotificationSettings } from '@notary-portal/api-contracts';
import { InAppNotificationsApiService } from '../rpc/in-app-notifications-api.service';
import { NotificationCounterService } from './notification-counter.service';
import { NotificationAuditSourceService } from './notification-audit-source.service';
import {
  mapRpcNotificationToUi,
  notificationChannelLabel,
  notificationStatusLabel,
  notificationTypeLabel,
  relativeTimeFrom,
} from './notification-mapper';
import type {
  NotificationChannelFilter,
  NotificationInboxFilters,
  NotificationReadFilter,
  NotificationTypeFilter,
  UiAuditNotificationSource,
  UiInAppNotification,
} from './notification.models';
import {
  markPopupNotificationSeen,
  readSeenPopupNotificationIds,
} from './notification-popup-seen.storage';
import {
  isInAppNotificationEnabled,
  normalizeNotificationSettings,
} from './notification-settings.utils';

const DEFAULT_FILTERS: NotificationInboxFilters = {
  type: 'all',
  channel: 'all',
  status: 'all',
};

@Component({
  selector: 'lib-notification-inbox-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notification-inbox-page.html',
  styleUrl: './notification-inbox-page.scss',
})
export class NotificationInboxPage implements OnInit, OnDestroy {
  readonly eyebrow = input('Кабинет');
  readonly pageTitle = input('Уведомления');
  readonly showAuditSource = input(true);
  readonly auditHistoryLimit = input(20);
  readonly auditPreviewCount = input(3);
  readonly showPopupOnUnread = input(false);
  readonly settingsRoute = input<readonly string[] | null>(['notifications/settings']);

  protected readonly route = inject(ActivatedRoute);
  protected readonly parentRoute = this.route.parent;

  private readonly notificationsApi = inject(InAppNotificationsApiService);
  private readonly notificationCounter = inject(NotificationCounterService);
  private readonly auditSourceApi = inject(NotificationAuditSourceService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private seenPopupIds = new Set<string>();

  protected readonly filters = signal<NotificationInboxFilters>({ ...DEFAULT_FILTERS });
  protected readonly auditExpanded = signal(false);
  protected readonly notificationSettings = signal<NotificationSettings | null>(null);
  protected readonly notifications = signal<UiInAppNotification[]>([]);
  protected readonly auditEvents = signal<UiAuditNotificationSource[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly popupNotification = signal<UiInAppNotification | null>(null);

  protected readonly typeLabel = notificationTypeLabel;
  protected readonly channelLabel = notificationChannelLabel;
  protected readonly statusLabel = notificationStatusLabel;

  protected readonly settingsLink = computed(() => this.settingsRoute());

  protected readonly filtered = computed(() => {
    const { type, channel, status } = this.filters();
    const settings = this.notificationSettings();

    return this.notifications().filter((item) => {
      if (!isInAppNotificationEnabled(settings, item)) {
        return false;
      }
      if (type !== 'all' && item.type !== type) {
        return false;
      }
      if (channel !== 'all' && item.channel !== channel) {
        return false;
      }
      if (status === 'unread' && !item.isUnread) {
        return false;
      }
      if (status === 'read' && item.isUnread) {
        return false;
      }
      return true;
    });
  });

  protected readonly visibleAuditEvents = computed(() => {
    const events = this.auditEvents();
    if (this.auditExpanded()) {
      return events;
    }
    return events.slice(0, this.auditPreviewCount());
  });

  protected readonly hiddenAuditCount = computed(() => {
    const total = this.auditEvents().length;
    const visible = this.visibleAuditEvents().length;
    return Math.max(0, total - visible);
  });

  protected readonly inboxCount = this.notificationCounter.unreadCount;

  async ngOnInit(): Promise<void> {
    const userId = this.notificationsApi.getCurrentUserId();
    if (userId) {
      this.seenPopupIds = readSeenPopupNotificationIds(userId);
    }

    await this.refresh();
    this.refreshTimer = setInterval(() => {
      void this.refresh({ preservePopup: true });
    }, 30_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  protected setFilter<K extends keyof NotificationInboxFilters>(
    key: K,
    value: NotificationInboxFilters[K],
  ): void {
    this.filters.update((current) => ({ ...current, [key]: value }));
  }

  protected setTypeFilter(value: NotificationTypeFilter): void {
    this.setFilter('type', value);
  }

  protected setChannelFilter(value: NotificationChannelFilter): void {
    this.setFilter('channel', value);
  }

  protected setStatusFilter(value: NotificationReadFilter): void {
    this.setFilter('status', value);
  }

  protected toggleAuditExpanded(): void {
    this.auditExpanded.update((value) => !value);
  }

  protected relativeTime(date: Date): string {
    return relativeTimeFrom(date);
  }

  protected auditSummary(event: UiAuditNotificationSource): string {
    const parts = [event.targetTitle, event.targetContext].filter(Boolean);
    return parts.join(' · ');
  }

  protected async markAllAsRead(): Promise<void> {
    await this.notificationsApi.markAllAsRead();
    this.notificationCounter.markAllAsRead();
    await this.refresh();
  }

  protected async toggleReadOnCard(id: string): Promise<void> {
    const target = this.notifications().find((item) => item.id === id);
    if (!target?.isUnread) {
      return;
    }

    await this.notificationsApi.markAsRead(id);
    this.notificationCounter.markOneAsRead();
    await this.refresh();
  }

  protected async removeOne(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    const target = this.notifications().find((item) => item.id === id);
    const wasUnread = target?.isUnread ?? false;
    await this.notificationsApi.deleteNotification(id);
    if (wasUnread) {
      this.notificationCounter.markOneAsRead();
    }
    await this.refresh();
  }

  protected closePopup(): void {
    const popup = this.popupNotification();
    if (popup) {
      this.rememberPopupSeen(popup.id);
    }
    this.popupNotification.set(null);
  }

  private async refresh(options?: { preservePopup?: boolean }): Promise<void> {
    this.loadError.set(null);

    try {
      const [listResult, auditEvents, settings] = await Promise.all([
        this.notificationsApi.listMine({ page: 1, limit: 50 }),
        this.showAuditSource()
          ? this.auditSourceApi.listAccountEvents({ limit: this.auditHistoryLimit() })
          : Promise.resolve([]),
        this.notificationsApi.getNotificationSettings().catch(() => null),
      ]);

      const mapped = listResult.notifications.map((item) => mapRpcNotificationToUi(item));
      this.notifications.set(mapped);
      this.notificationCounter.setUnreadCount(listResult.unreadCount);
      this.auditEvents.set(auditEvents);
      this.notificationSettings.set(
        settings ? normalizeNotificationSettings(settings) : null,
      );

      if (this.showPopupOnUnread() && !options?.preservePopup) {
        this.showPopupForLatestUnread(mapped);
      } else if (this.showPopupOnUnread() && options?.preservePopup) {
        this.syncPopupAfterRefresh(mapped);
      }
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Не удалось загрузить уведомления');
    }
  }

  private showPopupForLatestUnread(items: UiInAppNotification[]): void {
    const settings = this.notificationSettings();
    const candidate = items.find(
      (item) =>
        item.isUnread &&
        isInAppNotificationEnabled(settings, item) &&
        !this.seenPopupIds.has(item.id),
    );

    if (!candidate) {
      this.popupNotification.set(null);
      return;
    }

    this.popupNotification.set(candidate);
    this.rememberPopupSeen(candidate.id);
  }

  private syncPopupAfterRefresh(items: UiInAppNotification[]): void {
    const current = this.popupNotification();
    if (!current) {
      return;
    }

    const stillVisible = items.some((item) => item.id === current.id);
    if (!stillVisible) {
      this.popupNotification.set(null);
    }
  }

  private rememberPopupSeen(notificationId: string): void {
    if (this.seenPopupIds.has(notificationId)) {
      return;
    }

    this.seenPopupIds.add(notificationId);
    const userId = this.notificationsApi.getCurrentUserId();
    if (userId) {
      markPopupNotificationSeen(userId, notificationId);
    }
  }
}
