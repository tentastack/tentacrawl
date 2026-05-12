import type { ActivityLogItem } from '@tentacrawl/admin/data/schemas';
import type { NotificationItem } from '@tentacrawl/notification/data/schemas';

export function resolveNotificationHref(notification: NotificationItem): string | null {
  if (notification.entityType === 'scrape' && notification.entityId) {
    return `/scrape/${notification.entityId}`;
  }

  if (notification.entityType === 'crawl' && notification.entityId) {
    return `/crawl/${notification.entityId}`;
  }

  return null;
}

export function resolveActivityHref(event: ActivityLogItem): string | null {
  if (event.entityType === 'crawl-page' && event.entityId && event.correlationId) {
    return `/crawl/${event.correlationId}?inspectPageId=${event.entityId}`;
  }

  if (event.entityType === 'crawl' && event.entityId) {
    return `/crawl/${event.entityId}`;
  }

  if (event.entityType === 'scrape' && event.entityId) {
    return `/scrape/${event.entityId}`;
  }

  return null;
}