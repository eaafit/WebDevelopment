import { Component } from '@angular/core';
import { NotificationInboxPage } from '@notary-portal/ui';

@Component({
  selector: 'lib-notary-notifications',
  standalone: true,
  imports: [NotificationInboxPage],
  template: `
    <lib-notification-inbox-page
      eyebrow="Кабинет нотариуса"
      pageTitle="Уведомления"
      [showAuditSource]="true"
      [showPopupOnUnread]="true" />
  `,
})
export class NotaryNotifications {}
