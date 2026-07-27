import type { EntityManager } from '@mikro-orm/mongodb';
import type { ChallengerRunSeed } from '@tentacrawl/browser';
import { ChallengerSignalBus } from '../worker/challenger-signal.bus';

const seed: ChallengerRunSeed = {
  taskId: 't-1',
  taskType: 'scrape',
  workerId: 'w-1',
  source: 'dsl-runner',
  correlationId: 'c-1',
  hostname: 'example.com',
  origin: 'https://example.com',
  initialUrl: 'https://example.com',
  networkPolicy: { mode: 'none' },
};

function fakeEm(): { em: EntityManager; created: unknown[]; flush: jest.Mock } {
  const created: unknown[] = [];
  const flush = jest.fn().mockResolvedValue(undefined);
  const em = {
    fork: () => ({
      create: (_entity: unknown, record: unknown) => created.push(record),
      flush,
    }),
  } as unknown as EntityManager;
  return { em, created, flush };
}

describe('ChallengerSignalBus batching', () => {
  it('buffers signals and persists them in a single batch on flush', async () => {
    const { em, created, flush } = fakeEm();
    const bus = new ChallengerSignalBus(em);

    bus.publish('m/a', { signalType: 'network.blocked', severity: 'info' }, seed);
    bus.publish('m/b', { signalType: 'network.blocked', severity: 'warn' }, seed);

    // Nothing written yet: both signals are buffered.
    expect(created).toHaveLength(0);

    await bus.flush();

    expect(created).toHaveLength(2);
    expect(flush).toHaveBeenCalledTimes(1);
    await bus.onModuleDestroy();
  });

  it('redacts sensitive evidence before buffering', async () => {
    const { em, created } = fakeEm();
    const bus = new ChallengerSignalBus(em);

    bus.publish(
      'm/a',
      { signalType: 'network.blocked', severity: 'info', evidence: { password: 'x' } },
      seed,
    );
    await bus.flush();

    expect((created[0] as { evidence: { password: string } }).evidence.password).toBe(
      '[REDACTED]',
    );
    await bus.onModuleDestroy();
  });
});
