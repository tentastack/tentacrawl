import { Entity, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import type {
  ChallengerCapability,
  ChallengerSelectionDescriptor,
  ChallengerTarget,
} from '@tentacrawl/core';

// 'active' while loaded by a worker; 'archived' once removed, until purged
export type ChallengerRegistrationStatus = 'active' | 'archived';

@Entity({ collection: 'challenger_registrations' })
export class ChallengerRegistrationEntity {
  [OptionalProps]?: 'registeredAt' | 'lastSeenAt' | 'status';

  // fully-qualified extension id: `${moduleId}/${extensionId}`
  @PrimaryKey({ fieldName: '_id' })
  id!: string;

  @Property()
  status: ChallengerRegistrationStatus = 'active';

  @Property()
  moduleId!: string;

  @Property()
  extensionId!: string;

  @Property()
  version!: string;

  @Property({ nullable: true })
  priority?: number;

  @Property()
  capabilities!: ChallengerCapability[];

  @Property({ type: 'json', nullable: true })
  targets?: ChallengerTarget[];

  @Property({ type: 'json', nullable: true })
  selection?: ChallengerSelectionDescriptor;

  @Property()
  hasConfigSchema!: boolean;

  @Property()
  registeredAt: Date = new Date();

  @Property()
  lastSeenAt: Date = new Date();

  @Property({ nullable: true })
  lastRunAt?: Date;

  @Property({ nullable: true })
  lastError?: string;
}

@Entity({ collection: 'challenger_configs' })
export class ChallengerConfigEntity {
  [OptionalProps]?: 'enabled' | 'updatedAt';

  // fully-qualified extension id: `${moduleId}/${extensionId}`
  @PrimaryKey({ fieldName: '_id' })
  id!: string;

  @Property()
  enabled: boolean = true;

  @Property({ type: 'json', nullable: true })
  config?: Record<string, unknown>;

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}

@Entity({ collection: 'challenger_signals' })
export class ChallengerSignalEntity {
  [OptionalProps]?: 'id' | 'createdAt';

  @PrimaryKey({ fieldName: '_id' })
  id: string = crypto.randomUUID();

  @Property({ index: true })
  extensionId!: string;

  @Property({ index: true })
  taskId!: string;

  @Property({ nullable: true, index: true })
  correlationId?: string;

  @Property()
  signalType!: string;

  @Property()
  severity!: string;

  @Property({ nullable: true })
  source?: string;

  @Property({ type: 'json', nullable: true })
  evidence?: unknown;

  @Property({ type: 'json', nullable: true })
  annotations?: Record<string, unknown>;

  @Property()
  createdAt: Date = new Date();
}
