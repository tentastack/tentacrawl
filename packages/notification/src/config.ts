import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

const notificationConfigSchema = z.object({
  NOTIFICATION_DEFAULT_LIST_LIMIT: z.coerce.number().int().positive().default(12),
});

export type NotificationConfig = z.infer<typeof notificationConfigSchema>;

export function loadNotificationConfig(configService: ConfigService): NotificationConfig {
  return notificationConfigSchema.parse({
    NOTIFICATION_DEFAULT_LIST_LIMIT: configService.get('NOTIFICATION_DEFAULT_LIST_LIMIT'),
  });
}