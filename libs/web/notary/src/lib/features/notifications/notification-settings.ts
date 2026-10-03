import { Component } from '@angular/core';
import { NotificationSettingsPage } from '@notary-portal/ui';

@Component({
  selector: 'lib-notary-notification-settings',
  standalone: true,
  imports: [NotificationSettingsPage],
  template: `
    <lib-notification-settings-page
      eyebrow="Кабинет нотариуса"
      pageTitle="Настройки уведомлений" />
  `,
})
export class NotaryNotificationSettings {}
