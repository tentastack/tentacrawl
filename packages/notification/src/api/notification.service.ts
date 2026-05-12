import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import { ConfigService } from '@nestjs/config';
import { loadNotificationConfig } from '../config';
import { NotificationEntity } from '../data/entities';
import type { NotificationItem } from '../data/schemas';

@Injectable()
export class NotificationService {
  private readonly config;

  constructor(
    private readonly em: EntityManager,
    private readonly configService: ConfigService,
  ) {
    this.config = loadNotificationConfig(this.configService);
  }

  async listNotifications(limit = this.config.NOTIFICATION_DEFAULT_LIST_LIMIT): Promise<NotificationItem[]> {
    const items = await this.em.find(
      NotificationEntity,
      {},
      { orderBy: { createdAt: 'DESC' }, limit },
    );

    return items.map((item) => this.toNotificationItem(item));
  }

  async markNotificationRead(id: string): Promise<NotificationItem> {
    const notification = await this.em.findOneOrFail(NotificationEntity, { id });
    notification.readAt = new Date();
    await this.em.flush();
    return this.toNotificationItem(notification);
  }

  private toNotificationItem(notification: NotificationEntity): NotificationItem {
    return {
      id: notification.id,
      eventType: notification.eventType,
      source: notification.source,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      entityType: notification.entityType,
      entityId: notification.entityId,
      workerId: notification.workerId,
      correlationId: notification.correlationId,
      readAt: notification.readAt?.toISOString(),
      createdAt: notification.createdAt.toISOString(),
    };
  }
}