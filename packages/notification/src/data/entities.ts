import { Entity, Enum, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { NOTIFICATION_SEVERITY, NOTIFICATION_SOURCE } from '@tentacrawl/core/notification';
import type { NotificationSeverity, NotificationSource } from '@tentacrawl/core/notification';

@Entity({ collection: 'notifications' })
export class NotificationEntity {
  [OptionalProps]?: 'id' | 'createdAt' | 'metadata' | 'readAt';

  @PrimaryKey({ fieldName: '_id' })
  id: string = crypto.randomUUID();

  @Property()
  eventType!: string;

  @Enum({ items: () => NOTIFICATION_SOURCE })
  source!: NotificationSource;

  @Enum({ items: () => NOTIFICATION_SEVERITY })
  severity!: NotificationSeverity;

  @Property()
  title!: string;

  @Property()
  message!: string;

  @Property({ nullable: true })
  entityType?: string;

  @Property({ nullable: true })
  entityId?: string;

  @Property({ nullable: true })
  correlationId?: string;

  @Property({ nullable: true })
  workerId?: string;

  @Property({ nullable: true })
  readAt?: Date;

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @Property()
  createdAt: Date = new Date();
}