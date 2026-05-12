import { Controller, Get, Param, Patch } from '@nestjs/common';
import { notificationIdParamSchema } from '../data/schemas';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  getNotifications() {
    return this.notificationService.listNotifications();
  }

  @Patch(':id/read')
  markNotificationRead(@Param('id') id: string) {
    const params = notificationIdParamSchema.parse({ id });
    return this.notificationService.markNotificationRead(params.id);
  }
}