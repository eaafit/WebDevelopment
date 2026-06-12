import { Component } from '@angular/core';
import { NotificationSettingsPage } from '@notary-portal/ui';

@Component({
  selector: 'lib-admin-notification-settings',
  standalone: true,
  imports: [NotificationSettingsPage],
  template: `
    <lib-notification-settings-page
      eyebrow="Панель администратора"
      pageTitle="Настройки уведомлений" />
  `,
})
export class AdminNotificationSettings {}
