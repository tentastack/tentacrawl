import type {
  ChallengerBootstrapContext,
  ChallengerProxyCandidate,
  ChallengerRunOutcomeContext,
  ChallengerRuntimeContext,
  ChallengerSignal,
} from '@tentacrawl/core';
import { ProxyChallengerExtension } from '../worker/proxy.challenger';

const EXTENSION_KEY = 'proxy/manual';

interface Harness {
  ctx: ChallengerBootstrapContext;
  proxy: () => ChallengerProxyCandidate | undefined;
  signals: ChallengerSignal[];
  state: Map<string, unknown>;
}

function makeContext(
  networkPolicy: ChallengerRuntimeContext['networkPolicy'],
  config?: unknown,
): Harness {
  let candidate: ChallengerProxyCandidate | undefined;
  const signals: ChallengerSignal[] = [];
  const state = new Map<string, unknown>();
  const ctx = {
    taskId: 'task-1',
    taskType: 'scrape',
    correlationId: 'task-1',
    workerId: 'w-1',
    source: 'scrape-simple',
    networkPolicy,
    raw: {},
    state,
    config,
    contextOptions: {},
    helpers: {
      setProxyCandidate: (c: ChallengerProxyCandidate) => {
        candidate = c;
      },
      emitSignal: (signal: ChallengerSignal) => {
        signals.push(signal);
      },
    },
  } as unknown as ChallengerBootstrapContext;
  return { ctx, proxy: () => candidate, signals, state };
}

function captureHandlers(ext: ProxyChallengerExtension) {
  let bootstrap: ((ctx: ChallengerBootstrapContext) => Promise<void>) | undefined;
  let runOutcome: ((ctx: ChallengerRunOutcomeContext) => Promise<void>) | undefined;
  ext.register({
    onBootstrapContext: (handler: unknown) => {
      bootstrap = handler as typeof bootstrap;
    },
    onRunOutcome: (handler: unknown) => {
      runOutcome = handler as typeof runOutcome;
    },
  } as never);
  return { bootstrap: bootstrap!, runOutcome: runOutcome! };
}

describe('ProxyChallengerExtension', () => {
  it('registers itself with the registry on init and declares the selection descriptor', () => {
    const registry = { registerExtension: jest.fn() };
    const ext = new ProxyChallengerExtension(registry as never, {} as never);
    ext.onModuleInit();
    expect(registry.registerExtension).toHaveBeenCalledWith(ext);
    expect(ext.capabilities).toEqual(['proxy']);
    expect(ext.selection).toMatchObject({
      capability: 'proxy',
      optionsPath: '/proxy/servers/options',
    });
  });

  it('acquires a managed proxy targeted at this extension and stores the usage id', async () => {
    const proxyManager = {
      acquire: jest.fn().mockResolvedValue({
        server: 'http://proxy:8080',
        username: 'u',
        password: 'p',
        serverId: 'srv-1',
        endpointId: 'ep-1',
        usageId: 'usage-1',
      }),
      recordOutcome: jest.fn(),
    };
    const ext = new ProxyChallengerExtension({} as never, proxyManager as never);
    const { bootstrap } = captureHandlers(ext);
    const { ctx, proxy, state } = makeContext(
      { mode: 'managed', extension: EXTENSION_KEY, serverId: 'srv-1' },
      { rotation: 'random', countBlockedAsFailure: false },
    );

    await bootstrap(ctx);

    expect(proxyManager.acquire).toHaveBeenCalledWith({
      taskId: 'task-1',
      taskType: 'scrape',
      correlationId: 'task-1',
      serverId: 'srv-1',
      rotation: 'random',
    });
    expect(proxy()).toEqual({
      server: 'http://proxy:8080',
      username: 'u',
      password: 'p',
      id: 'ep-1',
    });
    expect(state.get('proxy:usageId')).toBe('usage-1');
  });

  it('ignores managed policies that target another extension', async () => {
    const proxyManager = { acquire: jest.fn(), recordOutcome: jest.fn() };
    const ext = new ProxyChallengerExtension({} as never, proxyManager as never);
    const { bootstrap } = captureHandlers(ext);
    const { ctx, proxy } = makeContext({
      mode: 'managed',
      extension: 'other/provider',
    });

    await bootstrap(ctx);
    expect(proxyManager.acquire).not.toHaveBeenCalled();
    expect(proxy()).toBeUndefined();
  });

  it('passes a static proxy through without acquiring', async () => {
    const proxyManager = { acquire: jest.fn(), recordOutcome: jest.fn() };
    const ext = new ProxyChallengerExtension({} as never, proxyManager as never);
    const { bootstrap } = captureHandlers(ext);
    const { ctx, proxy, state } = makeContext({
      mode: 'static',
      proxy: { server: 'http://static:3128', username: 'su', password: 'sp' },
    });

    await bootstrap(ctx);
    expect(proxyManager.acquire).not.toHaveBeenCalled();
    expect(proxy()).toEqual({
      server: 'http://static:3128',
      username: 'su',
      password: 'sp',
    });
    expect(state.has('proxy:usageId')).toBe(false);
  });

  it('emits a signal when no server is available', async () => {
    const proxyManager = {
      acquire: jest.fn().mockResolvedValue(null),
      recordOutcome: jest.fn(),
    };
    const ext = new ProxyChallengerExtension({} as never, proxyManager as never);
    const { bootstrap } = captureHandlers(ext);
    const { ctx, proxy, signals } = makeContext({
      mode: 'managed',
      extension: EXTENSION_KEY,
    });

    await bootstrap(ctx);
    expect(proxy()).toBeUndefined();
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      signalType: 'proxy.no-server-available',
      severity: 'warn',
    });
  });

  it('records the run outcome and emits a failure signal on ERROR', async () => {
    const proxyManager = {
      acquire: jest.fn(),
      recordOutcome: jest.fn().mockResolvedValue(undefined),
    };
    const ext = new ProxyChallengerExtension({} as never, proxyManager as never);
    const { runOutcome } = captureHandlers(ext);
    const { ctx, signals, state } = makeContext({ mode: 'none' });
    state.set('proxy:usageId', 'usage-7');
    const outcomeCtx = {
      ...ctx,
      outcome: 'ERROR',
      reason: 'navigation timed out',
    } as unknown as ChallengerRunOutcomeContext;

    await runOutcome(outcomeCtx);

    expect(proxyManager.recordOutcome).toHaveBeenCalledWith('usage-7', 'ERROR', {
      error: 'navigation timed out',
      countBlockedAsFailure: true,
    });
    expect(state.has('proxy:usageId')).toBe(false);
    expect(signals).toContainEqual(
      expect.objectContaining({ signalType: 'proxy.endpoint-failed', severity: 'warn' }),
    );
  });

  it('does not record anything when no usage is pending', async () => {
    const proxyManager = { acquire: jest.fn(), recordOutcome: jest.fn() };
    const ext = new ProxyChallengerExtension({} as never, proxyManager as never);
    const { runOutcome } = captureHandlers(ext);
    const { ctx } = makeContext({ mode: 'none' });
    const outcomeCtx = { ...ctx, outcome: 'OK' } as unknown as ChallengerRunOutcomeContext;

    await runOutcome(outcomeCtx);
    expect(proxyManager.recordOutcome).not.toHaveBeenCalled();
  });

  it('settles pending usage as ERROR via the onError safety net', async () => {
    const proxyManager = {
      acquire: jest.fn(),
      recordOutcome: jest.fn().mockResolvedValue(undefined),
    };
    const ext = new ProxyChallengerExtension({} as never, proxyManager as never);
    const { ctx, state } = makeContext({ mode: 'none' });
    state.set('proxy:usageId', 'usage-9');

    await ext.onError(ctx, new Error('browser crashed'));
    expect(proxyManager.recordOutcome).toHaveBeenCalledWith('usage-9', 'ERROR', {
      error: 'browser crashed',
      countBlockedAsFailure: true,
    });
    expect(state.has('proxy:usageId')).toBe(false);
  });
});
