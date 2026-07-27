import { ProxyManagerService } from '../worker/proxy-manager.service';
import { ProxyServerEntity, ProxyUsageEntity } from '../data/entities';
import type { ProxyEndpoint } from '../data/schemas';

function endpoint(overrides: Partial<ProxyEndpoint> & { id: string; url: string }): ProxyEndpoint {
  return {
    timesUsed: 0,
    timesSucceeded: 0,
    timesFailed: 0,
    ...overrides,
  };
}

interface FakeServer {
  id: string;
  name: string;
  enabled: boolean;
  username?: string;
  password?: string;
  endpoints: ProxyEndpoint[];
}

interface FakeUsage {
  id: string;
  serverId: string;
  endpointId: string;
  endpointUrl: string;
  taskId: string;
  taskType: string;
  correlationId?: string;
  outcome?: string;
  error?: string;
  startedAt: Date;
  finishedAt?: Date;
  durationMs?: number;
}

function makeEm(servers: FakeServer[], usages: FakeUsage[] = []) {
  const created: FakeUsage[] = [];
  const em = {
    find: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity !== ProxyServerEntity) return [];
      if (where.id) return servers.filter((s) => s.id === where.id);
      if (where.enabled) return servers.filter((s) => s.enabled);
      return servers;
    }),
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === ProxyUsageEntity) {
        return [...usages, ...created].find((u) => u.id === where.id) ?? null;
      }
      if (entity === ProxyServerEntity) {
        return servers.find((s) => s.id === where.id) ?? null;
      }
      return null;
    }),
    create: jest.fn((_entity: unknown, data: Omit<FakeUsage, 'id' | 'startedAt'>) => {
      const usage: FakeUsage = {
        id: `usage-${created.length + 1}`,
        startedAt: new Date(),
        ...data,
      };
      created.push(usage);
      return usage;
    }),
    // emulates the native positional array update used for atomic counter bumps
    getCollection: jest.fn((_entity: unknown) => ({
      updateOne: async (
        filter: Record<string, unknown>,
        update: Record<string, unknown>,
      ) => {
        const server = servers.find((s) => s.id === filter._id);
        const ep = server?.endpoints.find((e) => e.id === filter['endpoints.id']) as
          | Record<string, unknown>
          | undefined;
        if (!ep) return { matchedCount: 0 };
        const inc = (update.$inc ?? {}) as Record<string, number>;
        for (const [key, value] of Object.entries(inc)) {
          const field = key.replace('endpoints.$.', '');
          ep[field] = ((ep[field] as number) ?? 0) + value;
        }
        const set = (update.$set ?? {}) as Record<string, unknown>;
        for (const [key, value] of Object.entries(set)) {
          ep[key.replace('endpoints.$.', '')] = value;
        }
        return { matchedCount: 1 };
      },
    })),
    flush: jest.fn(async () => undefined),
  };
  const root = { fork: () => em } as never;
  return { root, em, created };
}

describe('ProxyManagerService.acquire', () => {
  it('returns null when no enabled server with endpoints exists', async () => {
    const { root } = makeEm([
      { id: 's1', name: 'disabled', enabled: false, endpoints: [endpoint({ id: 'e1', url: 'http://a:1' })] },
      { id: 's2', name: 'empty', enabled: true, endpoints: [] },
    ]);
    const service = new ProxyManagerService(root);

    const assignment = await service.acquire({
      taskId: 't1',
      taskType: 'scrape',
      rotation: 'round-robin',
    });
    expect(assignment).toBeNull();
  });

  it('acquires a specific server by id with shared credentials', async () => {
    const { root, created } = makeEm([
      {
        id: 's1',
        name: 'pool-a',
        enabled: true,
        username: 'user',
        password: 'pass',
        endpoints: [endpoint({ id: 'e1', url: 'http://a:1' })],
      },
    ]);
    const service = new ProxyManagerService(root);

    const assignment = await service.acquire({
      taskId: 't1',
      taskType: 'scrape',
      correlationId: 't1',
      serverId: 's1',
      rotation: 'round-robin',
    });

    expect(assignment).toMatchObject({
      server: 'http://a:1',
      username: 'user',
      password: 'pass',
      serverId: 's1',
      endpointId: 'e1',
    });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      serverId: 's1',
      endpointId: 'e1',
      taskId: 't1',
      correlationId: 't1',
    });
  });

  it('does not use a disabled server even when requested explicitly', async () => {
    const { root } = makeEm([
      {
        id: 's1',
        name: 'off',
        enabled: false,
        endpoints: [endpoint({ id: 'e1', url: 'http://a:1' })],
      },
    ]);
    const service = new ProxyManagerService(root);

    const assignment = await service.acquire({
      taskId: 't1',
      taskType: 'scrape',
      serverId: 's1',
      rotation: 'round-robin',
    });
    expect(assignment).toBeNull();
  });

  it('round-robin prefers the least recently used endpoint', async () => {
    const servers: FakeServer[] = [
      {
        id: 's1',
        name: 'pool',
        enabled: true,
        endpoints: [
          endpoint({ id: 'e1', url: 'http://a:1', lastUsedAt: new Date('2026-06-01') }),
          endpoint({ id: 'e2', url: 'http://b:2', lastUsedAt: new Date('2026-05-01') }),
        ],
      },
    ];
    const { root } = makeEm(servers);
    const service = new ProxyManagerService(root);

    const assignment = await service.acquire({
      taskId: 't1',
      taskType: 'scrape',
      rotation: 'round-robin',
    });
    expect(assignment?.endpointId).toBe('e2');
  });

  it('round-robin prefers a never-used endpoint and bumps its counters', async () => {
    const servers: FakeServer[] = [
      {
        id: 's1',
        name: 'pool',
        enabled: true,
        endpoints: [
          endpoint({ id: 'e1', url: 'http://a:1', lastUsedAt: new Date('2026-06-01'), timesUsed: 3 }),
          endpoint({ id: 'e2', url: 'http://b:2' }),
        ],
      },
    ];
    const { root } = makeEm(servers);
    const service = new ProxyManagerService(root);

    const assignment = await service.acquire({
      taskId: 't1',
      taskType: 'crawl-page',
      rotation: 'round-robin',
    });

    expect(assignment?.endpointId).toBe('e2');
    const updated = servers[0].endpoints.find((e) => e.id === 'e2')!;
    expect(updated.timesUsed).toBe(1);
    expect(updated.lastUsedAt).toBeInstanceOf(Date);
  });

  it('records a correlationId distinct from taskId for crawl-page tasks', async () => {
    const servers: FakeServer[] = [
      { id: 's1', name: 'pool', enabled: true, endpoints: [endpoint({ id: 'e1', url: 'http://a:1' })] },
    ];
    const { root, created } = makeEm(servers);
    const service = new ProxyManagerService(root);

    await service.acquire({
      taskId: 'page-1',
      taskType: 'crawl-page',
      correlationId: 'crawl-1',
      rotation: 'round-robin',
    });

    expect(created[0]).toMatchObject({ taskId: 'page-1', correlationId: 'crawl-1' });
  });
});

describe('ProxyManagerService.recordOutcome', () => {
  function setup(outcomePreset?: string) {
    const servers: FakeServer[] = [
      {
        id: 's1',
        name: 'pool',
        enabled: true,
        endpoints: [endpoint({ id: 'e1', url: 'http://a:1', timesUsed: 1 })],
      },
    ];
    const usages: FakeUsage[] = [
      {
        id: 'u1',
        serverId: 's1',
        endpointId: 'e1',
        endpointUrl: 'http://a:1',
        taskId: 't1',
        taskType: 'scrape',
        outcome: outcomePreset,
        startedAt: new Date(Date.now() - 1000),
      },
    ];
    const { root } = makeEm(servers, usages);
    return { service: new ProxyManagerService(root), servers, usages };
  }

  it('records OK and increments timesSucceeded', async () => {
    const { service, servers, usages } = setup();
    await service.recordOutcome('u1', 'OK', { countBlockedAsFailure: true });

    expect(usages[0].outcome).toBe('OK');
    expect(usages[0].finishedAt).toBeInstanceOf(Date);
    expect(usages[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(servers[0].endpoints[0].timesSucceeded).toBe(1);
    expect(servers[0].endpoints[0].timesFailed).toBe(0);
  });

  it('records ERROR and increments timesFailed with last error details', async () => {
    const { service, servers } = setup();
    await service.recordOutcome('u1', 'ERROR', {
      error: 'tunnel refused',
      countBlockedAsFailure: true,
    });

    const ep = servers[0].endpoints[0];
    expect(ep.timesFailed).toBe(1);
    expect(ep.lastError).toBe('tunnel refused');
    expect(ep.lastFailedAt).toBeInstanceOf(Date);
  });

  it('counts BLOCKED as failure only when configured', async () => {
    const a = setup();
    await a.service.recordOutcome('u1', 'BLOCKED', { countBlockedAsFailure: true });
    expect(a.servers[0].endpoints[0].timesFailed).toBe(1);

    const b = setup();
    await b.service.recordOutcome('u1', 'BLOCKED', { countBlockedAsFailure: false });
    expect(b.servers[0].endpoints[0].timesFailed).toBe(0);
    expect(b.usages[0].outcome).toBe('BLOCKED');
  });

  it('is idempotent for already settled usage records', async () => {
    const { service, servers } = setup('OK');
    await service.recordOutcome('u1', 'ERROR', { countBlockedAsFailure: true });
    expect(servers[0].endpoints[0].timesFailed).toBe(0);
  });
});
