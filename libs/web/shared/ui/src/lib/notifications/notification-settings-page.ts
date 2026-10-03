import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { NotificationChannelToggles, NotificationSettings } from '@notary-portal/api-contracts';
import { InAppNotificationsApiService } from '../rpc/in-app-notifications-api.service';
import {
  normalizeChannelToggles,
  normalizeNotificationSettings,
  updateChannelToggle,
} from './notification-settings.utils';

type SettingsCategory = 'assessment' | 'payment' | 'system';

interface CategoryRow {
  key: SettingsCategory;
  label: string;
  description: string;
}

const CATEGORY_ROWS: CategoryRow[] = [
  {
    key: 'assessment',
    label: 'Заявки на оценку',
    description: 'Создание, статусы и завершение заявок',
  },
  {
    key: 'payment',
    label: 'Платежи',
    description: 'Оплата услуг, подписки и чеки',
  },
  {
    key: 'system',
    label: 'Системные',
    description: 'Безопасность, вход и сервисные сообщения',
  },
];

@Component({
  selector: 'lib-notification-settings-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notification-settings-page.html',
  styleUrl: './notification-settings-page.scss',
})
export class NotificationSettingsPage implements OnInit {
  readonly eyebrow = input('Кабинет');
  readonly pageTitle = input('Настройки уведомлений');
  readonly backRoute = input<readonly string[] | string>(['..']);

  protected readonly route = inject(ActivatedRoute);
  private readonly notificationsApi = inject(InAppNotificationsApiService);

  protected readonly categories = CATEGORY_ROWS;
  protected readonly settings = signal<NotificationSettings | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveMessage = signal<string | null>(null);
  protected readonly isSaving = signal(false);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected channelEnabled(
    category: SettingsCategory,
    channel: keyof NotificationChannelToggles,
  ): boolean {
    const toggles = this.settings()?.[category];
    const normalized = normalizeChannelToggles(toggles);

    switch (channel) {
      case 'emailEnabled':
        return normalized.emailEnabled;
      case 'pushEnabled':
        return normalized.pushEnabled;
      case 'inAppEnabled':
      default:
        return normalized.inAppEnabled;
    }
  }

  protected async onToggle(
    category: SettingsCategory,
    channel: keyof NotificationChannelToggles,
    event: Event,
  ): Promise<void> {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.settings();
    if (!current) {
      return;
    }

    const next = updateChannelToggle(current, category, channel, checked);
    this.settings.set(next);
    await this.save(next);
  }

  private async load(): Promise<void> {
    this.loadError.set(null);

    try {
      const settings = await this.notificationsApi.getNotificationSettings();
      this.settings.set(normalizeNotificationSettings(settings));
    } catch (error) {
      this.loadError.set(
        error instanceof Error ? error.message : 'Не удалось загрузить настройки',
      );
    }
  }

  private async save(settings: NotificationSettings): Promise<void> {
    this.isSaving.set(true);
    this.saveMessage.set(null);
    this.loadError.set(null);

    try {
      const saved = await this.notificationsApi.updateNotificationSettings(settings);
      this.settings.set(normalizeNotificationSettings(saved));
      this.saveMessage.set('Настройки сохранены');
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Не удалось сохранить настройки');
      await this.load();
    } finally {
      this.isSaving.set(false);
    }
  }
}
