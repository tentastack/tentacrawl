import { Entity, Enum, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { ACTIVITY_LOG_SEVERITY, ACTIVITY_LOG_SOURCE } from '@tentacrawl/core/activity';
import type { ActivityLogSeverity, ActivityLogSource } from '@tentacrawl/core/activity';

@Entity({ collection: 'worker_instances' })
export class WorkerInstanceEntity {
  [OptionalProps]?: 'id' | 'createdAt' | 'lastHeartbeatAt';

  @PrimaryKey({ fieldName: '_id' })
  id: string = crypto.randomUUID();

  @Property({ unique: true })
  workerId!: string;

  @Property()
  hostname!: string;

  @Property()
  pid!: number;

  @Property()
  port!: number;

  @Property()
  version!: string;

  @Property()
  startedAt!: Date;

  @Property()
  lastHeartbeatAt: Date = new Date();

  @Property({ type: 'json' })
  supportedQueues!: string[];

  @Property({ type: 'json' })
  supportedModules!: string[];

  @Property()
  createdAt: Date = new Date();
}

@Entity({ collection: 'activity_logs' })
export class ActivityLogEntity {
  [OptionalProps]?: 'id' | 'createdAt' | 'metadata';

  @PrimaryKey({ fieldName: '_id' })
  id: string = crypto.randomUUID();

  @Property()
  eventType!: string;

  @Enum({ items: () => ACTIVITY_LOG_SOURCE })
  source!: ActivityLogSource;

  @Enum({ items: () => ACTIVITY_LOG_SEVERITY })
  severity!: ActivityLogSeverity;

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

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @Property()
  createdAt: Date = new Date();
}