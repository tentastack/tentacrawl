import { Entity, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import type { ProxyLeaseStatus } from './schemas';

@Entity({ collection: 'proxy_pools' })
export class ProxyPoolEntity {
  [OptionalProps]?: 'id' | 'createdAt' | 'updatedAt';

  @PrimaryKey({ fieldName: '_id' })
  id: string = crypto.randomUUID();

  @Property()
  name!: string;

  @Property()
  provider!: string;

  @Property()
  providerConfig!: Record<string, unknown>;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}

@Entity({ collection: 'proxy_leases' })
export class ProxyLeaseEntity {
  [OptionalProps]?: 'id' | 'assignedAt' | 'status';

  @PrimaryKey({ fieldName: '_id' })
  id: string = crypto.randomUUID();

  @Property()
  poolId!: string;

  @Property()
  taskId!: string;

  @Property({ nullable: true })
  sessionId?: string;

  @Property()
  assignedAt: Date = new Date();

  @Property({ nullable: true })
  releasedAt?: Date;

  @Property()
  status: ProxyLeaseStatus = 'ACTIVE';
}
