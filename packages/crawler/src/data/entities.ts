import { Entity, OptionalProps, PrimaryKey, Property, Enum, Index } from '@mikro-orm/core';
import type { CrawlStatus, CrawlPageStatus, NetworkPolicy } from '@tentacrawl/core';
import type { CrawlPageResult } from './schemas';

@Entity({ collection: 'crawls' })
export class CrawlEntity {
  [OptionalProps]?: 'id' | 'status' | 'totalPages' | 'completedPages' | 'failedPages' | 'createdAt';

  @PrimaryKey({ fieldName: '_id' })
  id: string = crypto.randomUUID();

  @Property()
  url!: string;

  @Property({ index: true })
  origin!: string;

  @Property()
  maxDepth!: number;

  @Property()
  maxPages!: number;

  @Property()
  artefacts!: string[];

  @Enum({ items: () => ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] })
  status: CrawlStatus = 'PENDING';

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
  includePattern?: string;

  @Property({ nullable: true })
  excludePattern?: string;

  @Property({ nullable: true })
  dslYaml?: string;

  @Property()
  totalPages: number = 0;

  @Property()
  completedPages: number = 0;

  @Property()
  failedPages: number = 0;

  @Property()
  createdAt: Date = new Date();

  @Property({ nullable: true })
  completedAt?: Date;
}

@Entity({ collection: 'crawl_pages' })
@Index({ properties: ['crawlId', 'url'] })
export class CrawlPageEntity {
  [OptionalProps]?: 'id' | 'status' | 'createdAt' | 'discoveredUrlCount';

  @PrimaryKey({ fieldName: '_id' })
  id: string = crypto.randomUUID();

  @Property({ index: true })
  crawlId!: string;

  @Property()
  url!: string;

  @Property()
  depth!: number;

  @Enum({ items: () => ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED'] })
  status: CrawlPageStatus = 'PENDING';

  @Property({ type: 'json', nullable: true })
  result?: CrawlPageResult;

  @Property({ nullable: true })
  durationMs?: number;

  @Property()
  discoveredUrlCount: number = 0;

  @Property({ nullable: true })
  error?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ nullable: true })
  completedAt?: Date;
}
