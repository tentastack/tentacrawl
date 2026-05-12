import type { ModuleInfo } from '@tentacrawl/core';

export const metadata: ModuleInfo = {
  name: 'notification',
  title: 'Notification',
  version: '0.1.0',
  description: 'Business notifications for scrape, crawl, and future module lifecycle events',
};

export { NotificationModule } from './notification.module';
export {
  notificationItemSchema,
  notificationIdParamSchema,
} from './data/schemas';
export type {
  NotificationItem,
  NotificationIdParam,
} from './data/schemas';
export { NotificationEntity } from './data/entities';