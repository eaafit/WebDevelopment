import { Component } from '@angular/core';
import { NotificationInboxPage } from '@notary-portal/ui';

@Component({
  selector: 'lib-applicant-notifications',
  standalone: true,
  imports: [NotificationInboxPage],
  template: `
    <lib-notification-inbox-page
      eyebrow="Кабинет заявителя"
      pageTitle="Уведомления"
      [showAuditSource]="false"
      [showPopupOnUnread]="true" />
  `,
})
export class ApplicantNotifications {}
