import { Injectable } from '@nestjs/common';
import { NotificationService } from './notification.service';
import type {
  DeleteNotificationRequest,
  DeleteNotificationResponse,
  GetNotificationSettingsRequest,
  GetNotificationSettingsResponse,
  ListNotificationsRequest,
  ListNotificationsResponse,
  MarkAllAsReadRequest,
  MarkAllAsReadResponse,
  MarkAsReadRequest,
  MarkAsReadResponse,
  UpdateNotificationSettingsRequest,
  UpdateNotificationSettingsResponse,
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

  readonly getNotificationSettings = (
    r: GetNotificationSettingsRequest,
  ): Promise<GetNotificationSettingsResponse> => this.notificationService.getNotificationSettings(r);

  readonly updateNotificationSettings = (
    r: UpdateNotificationSettingsRequest,
  ): Promise<UpdateNotificationSettingsResponse> =>
    this.notificationService.updateNotificationSettings(r);
}
