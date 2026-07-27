import { Entity, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import type { RunOutcome } from '@tentacrawl/core';
import type { ProxyEndpoint } from './schemas';

@Entity({ collection: 'proxy_servers' })
export class ProxyServerEntity {
  [OptionalProps]?: 'id' | 'enabled' | 'createdAt' | 'updatedAt';

  @PrimaryKey({ fieldName: '_id' })
  id: string = crypto.randomUUID();

  @Property()
  name!: string;

  @Property()
  enabled: boolean = true;

  // ISO 3166-1 alpha-2 country code
  @Property({ nullable: true, index: true })
  location?: string;

  @Property({ nullable: true })
  username?: string;

  @Property({ nullable: true })
  password?: string;

  @Property({ nullable: true })
  notes?: string;

  @Property({ type: 'json' })
  endpoints!: ProxyEndpoint[];

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}

@Entity({ collection: 'proxy_usage' })
export class ProxyUsageEntity {
  [OptionalProps]?: 'id' | 'startedAt';

  @PrimaryKey({ fieldName: '_id' })
  id: string = crypto.randomUUID();

  @Property({ index: true })
  serverId!: string;

  @Property({ index: true })
  endpointId!: string;

  @Property()
  endpointUrl!: string;

  @Property({ index: true })
  taskId!: string;

  @Property()
  taskType!: string;

  // the run's top-level id; for crawl-page tasks this is the parent crawlId
  // (taskId is the individual page id) — lets the UI link to the right detail page
  @Property({ nullable: true })
  correlationId?: string;

  @Property({ nullable: true })
  outcome?: RunOutcome;

  @Property({ nullable: true })
  error?: string;

  @Property()
  startedAt: Date = new Date();

  @Property({ nullable: true })
  finishedAt?: Date;

  @Property({ nullable: true })
  durationMs?: number;
}
