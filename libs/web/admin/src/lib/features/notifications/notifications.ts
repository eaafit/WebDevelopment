import { Component } from '@angular/core';
import { NotificationInboxPage } from '@notary-portal/ui';

@Component({
  selector: 'lib-notifications',
  standalone: true,
  imports: [NotificationInboxPage],
  template: `
    <lib-notification-inbox-page
      eyebrow="Панель администратора"
      pageTitle="Уведомления"
      [showAuditSource]="true"
      [showPopupOnUnread]="false" />
  `,
})
export class AdminNotifications {}
