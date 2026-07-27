import type { ChallengerExtension } from '@tentacrawl/core';
import { ChallengerRegistrationSyncService } from '../worker/challenger-registration.sync';

interface Row {
  id: string;
  [k: string]: unknown;
}

function makeEm(existing: Row[]) {
  const created: Row[] = [];
  const updateCalls: Array<{ where: unknown; data: unknown }> = [];
  const inner = {
    findOne: jest.fn(async (_e: unknown, where: { id: string }) =>
      existing.find((r) => r.id === where.id) ?? null,
    ),
    create: jest.fn((_e: unknown, data: Row) => {
      created.push(data);
      return data;
    }),
    flush: jest.fn(async () => undefined),
    fork: jest.fn(() => ({
      nativeUpdate: jest.fn(async (_e: unknown, where: unknown, data: unknown) => {
        updateCalls.push({ where, data });
        return 1;
      }),
    })),
  };
  const em = { fork: jest.fn(() => inner) };
  return { em, inner, created, updateCalls };
}

function ext(overrides: Partial<ChallengerExtension>): ChallengerExtension {
  return {
    moduleId: 'm',
    extensionId: 'e',
    version: '1.0.0',
    capabilities: [],
    ...overrides,
  };
}

describe('ChallengerRegistrationSyncService', () => {
  it('skips all DB work when no extensions are loaded (empty-registry guard)', async () => {
    const registry = { getExtensions: () => [] } as never;
    const { em } = makeEm([]);
    const svc = new ChallengerRegistrationSyncService(registry, em as never);

    await svc.onApplicationBootstrap();

    expect(em.fork).not.toHaveBeenCalled();
  });

  it('creates a new active registration and archives rows no longer loaded', async () => {
    const registry = {
      getExtensions: () => [ext({ moduleId: 'proxy', extensionId: 'manual' })],
    } as never;
    const { em, created, updateCalls } = makeEm([]);
    const svc = new ChallengerRegistrationSyncService(registry, em as never);

    await svc.onApplicationBootstrap();

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ id: 'proxy/manual', status: 'active' });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].where).toEqual({
      id: { $nin: ['proxy/manual'] },
      status: { $ne: 'archived' },
    });
    expect(updateCalls[0].data).toEqual({ status: 'archived' });
  });

  it('updates an existing registration in place and marks it active', async () => {
    const existing: Row = { id: 'm/e', version: '0.9.0', status: 'archived' };
    const registry = {
      getExtensions: () => [ext({ version: '1.2.0' })],
    } as never;
    const { em } = makeEm([existing]);
    const svc = new ChallengerRegistrationSyncService(registry, em as never);

    await svc.onApplicationBootstrap();

    expect(existing.version).toBe('1.2.0');
    expect(existing.status).toBe('active');
  });
});
