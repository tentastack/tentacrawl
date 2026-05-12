import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mongodb';
import type { CreateNotificationInput, NotificationPublisher } from '@tentacrawl/core/notification';
import { NotificationEntity } from '../data/entities';

@Injectable()
export class NotificationPublisherService implements NotificationPublisher {
  private readonly logger = new Logger(NotificationPublisherService.name);

  constructor(private readonly em: EntityManager) {}

  async publish(input: CreateNotificationInput): Promise<void> {
    try {
      const notification = this.em.create(NotificationEntity, input);
      await this.em.persistAndFlush(notification);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to persist notification ${input.eventType}: ${message}`);
    }
  }
}