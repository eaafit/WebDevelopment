import { Component } from '@angular/core';
import { NotificationSettingsPage } from '@notary-portal/ui';

@Component({
  selector: 'lib-applicant-notification-settings',
  standalone: true,
  imports: [NotificationSettingsPage],
  template: `
    <lib-notification-settings-page
      eyebrow="Кабинет заявителя"
      pageTitle="Настройки уведомлений" />
  `,
})
export class ApplicantNotificationSettings {}
