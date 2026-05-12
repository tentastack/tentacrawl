import { Entity, OptionalProps, PrimaryKey, Property, Enum } from '@mikro-orm/core';
import type { TaskStatus, NetworkPolicy } from '@tentacrawl/core';
import type { ScrapeResult } from './schemas';

@Entity({ collection: 'scrapes' })
export class ScrapeEntity {
  [OptionalProps]?: 'id' | 'status' | 'createdAt';

  @PrimaryKey({ fieldName: '_id' })
  id: string = crypto.randomUUID();

  @Property()
  url!: string;

  @Property({ index: true })
  origin!: string;

  @Property()
  artefacts!: string[];

  @Enum({ items: () => ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] })
  status: TaskStatus = 'PENDING';

  @Property({ type: 'json' })
  networkPolicy!: NetworkPolicy;

  @Property()
  timeout!: number;

  @Property()
  waitFor!: string;

  @Property({ nullable: true })
  locale?: string;

  @Property({ nullable: true })
  timezone?: string;

  @Property({ type: 'json', nullable: true })
  headers?: Record<string, string>;

  @Property({ nullable: true })
  dslYaml?: string;

  @Property({ type: 'json', nullable: true })
  result?: ScrapeResult;

  @Property({ nullable: true })
  durationMs?: number;

  @Property({ nullable: true })
  error?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ nullable: true })
  completedAt?: Date;
}
