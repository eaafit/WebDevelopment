import { Injectable } from '@nestjs/common';
import { NotificationService } from './notification.service';
import type {
  DeleteNotificationRequest,
  DeleteNotificationResponse,
  ListNotificationsRequest,
  ListNotificationsResponse,
  MarkAllAsReadRequest,
  MarkAllAsReadResponse,
  MarkAsReadRequest,
  MarkAsReadResponse,
} from '@notary-portal/api-contracts';

@Injectable()
export class NotificationRpcService {
  constructor(private readonly notificationService: NotificationService) {}

  readonly listNotifications  = (r: ListNotificationsRequest):  Promise<ListNotificationsResponse>  =>
    this.notificationService.listNotifications(r);

  readonly markAsRead         = (r: MarkAsReadRequest):         Promise<MarkAsReadResponse>         =>
    this.notificationService.markAsRead(r);

  readonly markAllAsRead      = (r: MarkAllAsReadRequest):      Promise<MarkAllAsReadResponse>      =>
    this.notificationService.markAllAsRead(r);

  readonly deleteNotification = (r: DeleteNotificationRequest): Promise<DeleteNotificationResponse> =>
    this.notificationService.deleteNotification(r);
}
