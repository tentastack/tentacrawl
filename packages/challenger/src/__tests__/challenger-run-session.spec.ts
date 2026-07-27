import { z } from 'zod';
import type {
  ChallengerExtension,
  ChallengerSignal,
} from '@tentacrawl/core';
import type { ChallengerRunSeed } from '@tentacrawl/browser';
import {
  ChallengerRunSessionImpl,
  type CollectedHandler,
  type RunnableExtension,
  type RunSessionHooks,
  type RunSessionLogger,
} from '../worker/challenger-run-session';

const seed: ChallengerRunSeed = {
  taskId: 't-1',
  taskType: 'scrape',
  workerId: 'w-1',
  source: 'dsl-runner',
  correlationId: 'c-1',
  hostname: 'example.com',
  origin: 'https://example.com',
  initialUrl: 'https://example.com/page',
  networkPolicy: { mode: 'none' },
};

const silentLogger: RunSessionLogger = {
  warn: () => undefined,
  debug: () => undefined,
  error: () => undefined,
};

function makeHooks(): { hooks: RunSessionHooks; signals: ChallengerSignal[]; ended: unknown[] } {
  const signals: ChallengerSignal[] = [];
  const ended: unknown[] = [];
  return {
    signals,
    ended,
    hooks: {
      persistSignal: (_key, signal) => signals.push(signal),
      onEnd: async (summary) => {
        ended.push(summary);
      },
    },
  };
}

function extension(overrides: Partial<ChallengerExtension>): ChallengerExtension {
  return {
    moduleId: 'm',
    extensionId: 'e',
    version: '1.0.0',
    capabilities: [],
    ...overrides,
  };
}

function runnable(
  ext: ChallengerExtension,
  handlers: Array<Omit<CollectedHandler, 'seq'>>,
  config: unknown = undefined,
): RunnableExtension {
  return {
    extension: ext,
    key: `${ext.moduleId}/${ext.extensionId}`,
    handlers: handlers.map((h, seq) => ({ ...h, seq })),
    actions: [],
    config,
    state: new Map(),
  };
}

describe('ChallengerRunSessionImpl', () => {
  it('runs mutating handlers serially in priority order', async () => {
    const calls: string[] = [];
    const extA = extension({ extensionId: 'a', priority: 50 });
    const extB = extension({ extensionId: 'b', priority: 10 });

    const runnables = [
      runnable(extA, [
        {
          stage: 'before-step',
          options: { mode: 'mutating' },
          handler: () => {
            calls.push('a');
          },
        },
      ]),
      runnable(extB, [
        {
          stage: 'before-step',
          options: { mode: 'mutating' },
          handler: () => {
            calls.push('b');
          },
        },
      ]),
    ];

    const { hooks } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    await session.dispatch('before-step', { step: { index: 0, action: 'goto' } });
    expect(calls).toEqual(['b', 'a']);
  });

  it('resolves proxy candidate via helpers as last-writer-wins', async () => {
    const extA = extension({ extensionId: 'a', priority: 10 });
    const extB = extension({ extensionId: 'b', priority: 20 });
    const runnables = [
      runnable(extA, [
        {
          stage: 'bootstrap-context',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            void (ctx as { helpers: { setProxyCandidate: (c: unknown) => void } }).helpers.setProxyCandidate({
              server: 'http://a',
            });
          },
        },
      ]),
      runnable(extB, [
        {
          stage: 'bootstrap-context',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            void (ctx as { helpers: { setProxyCandidate: (c: unknown) => void } }).helpers.setProxyCandidate({
              server: 'http://b',
            });
          },
        },
      ]),
    ];

    const { hooks } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    const result = await session.dispatch('bootstrap-context', { contextOptions: {} });
    expect(result.contextOptions?.proxy?.server).toBe('http://b');
    expect(session.ctx.proxy?.server).toBe('http://b');
  });

  it('merges header patches in order', async () => {
    const ext = extension({});
    const runnables = [
      runnable(ext, [
        {
          stage: 'bootstrap-context',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            const helpers = (ctx as { helpers: { patchContextOptions: (p: unknown) => void } }).helpers;
            helpers.patchContextOptions({ headers: { a: '1' } });
            helpers.patchContextOptions({ headers: { b: '2' } });
          },
        },
      ]),
    ];

    const { hooks } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    const result = await session.dispatch('bootstrap-context', { contextOptions: {} });
    expect(result.contextOptions?.headers).toEqual({ a: '1', b: '2' });
  });

  it('isolates state between extensions', async () => {
    const observed: Array<unknown> = [];
    const extA = extension({ extensionId: 'a' });
    const extB = extension({ extensionId: 'b' });
    const runnables = [
      runnable(extA, [
        {
          stage: 'before-step',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            (ctx as { state: Map<string, unknown> }).state.set('secret', 'a-only');
          },
        },
      ]),
      runnable(extB, [
        {
          stage: 'before-step',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            observed.push((ctx as { state: Map<string, unknown> }).state.get('secret'));
          },
        },
      ]),
    ];

    const { hooks } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    await session.dispatch('before-step', { step: { index: 0, action: 'goto' } });
    expect(observed).toEqual([undefined]);
  });

  it('observer handlers cannot mutate run state', async () => {
    const ext = extension({});
    const runnables = [
      runnable(ext, [
        {
          stage: 'after-navigation',
          options: { mode: 'observer' },
          handler: (ctx: never) => {
            (ctx as { helpers: { setProxyCandidate: (c: unknown) => void } }).helpers.setProxyCandidate({
              server: 'http://nope',
            });
          },
        },
      ]),
    ];

    const { hooks } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    await session.dispatch('after-navigation', { requestedUrl: 'https://example.com' });
    expect(session.ctx.proxy).toBeUndefined();
  });

  it('applies fail-run error policy', async () => {
    const ext = extension({});
    const runnables = [
      runnable(ext, [
        {
          stage: 'before-step',
          options: { mode: 'mutating', errorPolicy: 'fail-run' },
          handler: () => {
            throw new Error('boom');
          },
        },
      ]),
    ];

    const { hooks, signals } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    const result = await session.dispatch('before-step', { step: { index: 0, action: 'goto' } });
    expect(result.failRun?.status).toBe('ERROR');
    expect(signals.some((s) => s.signalType === 'challenger.handler-error')).toBe(true);
  });

  it('disables an extension for the run under disable policy', async () => {
    const calls: string[] = [];
    const ext = extension({});
    const runnables = [
      runnable(ext, [
        {
          stage: 'before-step',
          options: { mode: 'mutating', errorPolicy: 'disable-extension-for-run' },
          handler: () => {
            calls.push('first');
            throw new Error('boom');
          },
        },
        {
          stage: 'after-step',
          options: { mode: 'mutating' },
          handler: () => {
            calls.push('second');
          },
        },
      ]),
    ];

    const { hooks } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    await session.dispatch('before-step', { step: { index: 0, action: 'goto' } });
    await session.dispatch('after-step', { step: { index: 0, action: 'goto' } });
    expect(calls).toEqual(['first']);
  });

  it('enforces a per-handler timeout', async () => {
    const ext = extension({});
    const runnables = [
      runnable(ext, [
        {
          stage: 'before-step',
          options: { mode: 'mutating', timeoutMs: 10, errorPolicy: 'fail-run' },
          handler: () => new Promise(() => undefined),
        },
      ]),
    ];

    const { hooks } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    const result = await session.dispatch('before-step', { step: { index: 0, action: 'goto' } });
    expect(result.failRun?.reason).toContain('timed out');
  });

  it('filters handlers by target hostname', async () => {
    const calls: string[] = [];
    const ext = extension({});
    const runnables = [
      runnable(ext, [
        {
          stage: 'before-step',
          options: { mode: 'mutating', targets: [{ hostnames: ['other.com'] }] },
          handler: () => {
            calls.push('skip');
          },
        },
        {
          stage: 'before-step',
          options: { mode: 'mutating', targets: [{ hostnames: ['example.com'] }] },
          handler: () => {
            calls.push('match');
          },
        },
      ]),
    ];

    const { hooks } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    await session.dispatch('before-step', { step: { index: 0, action: 'goto' } });
    expect(calls).toEqual(['match']);
  });

  it('fans signals to onSignal handlers and persists them', async () => {
    const received: ChallengerSignal[] = [];
    const emitter = extension({ extensionId: 'emitter' });
    const listener = extension({ extensionId: 'listener' });
    const runnables = [
      runnable(emitter, [
        {
          stage: 'after-navigation',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            (ctx as { helpers: { emitSignal: (s: ChallengerSignal) => void } }).helpers.emitSignal({
              signalType: 'network.challenge-header',
              severity: 'warn',
            });
          },
        },
      ]),
      runnable(listener, [
        {
          stage: 'signal',
          options: { mode: 'observer' },
          handler: (ctx: never) => {
            received.push((ctx as { signal: ChallengerSignal }).signal);
          },
        },
      ]),
    ];

    const { hooks, signals } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    await session.dispatch('after-navigation', { requestedUrl: 'https://example.com' });
    expect(received).toHaveLength(1);
    expect(received[0].signalType).toBe('network.challenge-header');
    expect(signals.some((s) => s.signalType === 'network.challenge-header')).toBe(true);
  });

  it('runs coarse beforeRun then afterRun/onError on end', async () => {
    const calls: string[] = [];
    const ext = extension({
      beforeRun: async () => {
        calls.push('before');
      },
      afterRun: async () => {
        calls.push('after');
      },
      onError: async () => {
        calls.push('error');
      },
    });

    const { hooks, ended } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, [runnable(ext, [])], hooks, silentLogger);
    await session.dispatch('bootstrap-context', { contextOptions: {} });
    await session.end('ERROR', new Error('fail'));
    expect(calls).toEqual(['before', 'error', 'after']);
    expect(ended).toHaveLength(1);
  });

  it('attributes handler errors only to the failing extension', async () => {
    const ok = extension({ extensionId: 'ok' });
    const bad = extension({ extensionId: 'bad' });
    const runnables = [
      runnable(ok, [{ stage: 'before-step', options: {}, handler: () => undefined }]),
      runnable(bad, [
        {
          stage: 'before-step',
          options: {},
          handler: () => {
            throw new Error('boom');
          },
        },
      ]),
    ];

    const { hooks, ended } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    await session.dispatch('before-step', { step: { index: 0, action: 'goto' } });
    await session.end('OK');

    const summary = ended[0] as { handlerErrors: Map<string, string> };
    expect(summary.handlerErrors.has('m/bad')).toBe(true);
    expect(summary.handlerErrors.get('m/bad')).toContain('boom');
    expect(summary.handlerErrors.has('m/ok')).toBe(false);
  });

  it('namespaces appended artifacts per extension', async () => {
    const ext = extension({ extensionId: 'collector' });
    const runnables = [
      runnable(ext, [
        {
          stage: 'artefact-collected',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            (ctx as { helpers: { appendArtifact: (k: string, v: unknown) => void } }).helpers.appendArtifact(
              'score',
              42,
            );
          },
        },
      ]),
    ];

    const { hooks } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    await session.dispatch('artefact-collected', { artifactKey: 'html', artifactValue: '<html>' });
    expect(session.collectAppendedArtifacts()).toEqual({
      'challenger.collector.score': 42,
    });
  });

  const routeInfo = {
    url: 'https://example.com/api',
    method: 'GET',
    resourceType: 'xhr',
    headers: { 'x-orig': '1' },
    isNavigationRequest: false,
  };

  it('passes through when no route handlers are registered', async () => {
    const session = new ChallengerRunSessionImpl(seed, [runnable(extension({}), [])], makeHooks().hooks, silentLogger);
    expect(session.hasRouteHandlers()).toBe(false);
    expect(await session.routeRequest(routeInfo)).toEqual({ action: 'continue' });
  });

  it('merges request overrides from multiple handlers in priority order', async () => {
    const extA = extension({ extensionId: 'a', priority: 20 });
    const extB = extension({ extensionId: 'b', priority: 10 });
    const runnables = [
      runnable(extA, [
        {
          stage: 'route-request',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            (ctx as { route: { modifyRequest: (p: unknown) => void } }).route.modifyRequest({
              headers: { 'x-a': 'a', shared: 'from-a' },
            });
          },
        },
      ]),
      runnable(extB, [
        {
          stage: 'route-request',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            (ctx as { route: { modifyRequest: (p: unknown) => void } }).route.modifyRequest({
              headers: { 'x-b': 'b', shared: 'from-b' },
            });
          },
        },
      ]),
    ];
    const session = new ChallengerRunSessionImpl(seed, runnables, makeHooks().hooks, silentLogger);
    expect(session.hasRouteHandlers()).toBe(true);
    const decision = await session.routeRequest(routeInfo);
    // extB runs first (priority 10), then extA overwrites the shared header.
    expect(decision).toEqual({
      action: 'continue',
      override: { headers: { 'x-b': 'b', shared: 'from-a', 'x-a': 'a' } },
    });
  });

  it('lets the first terminal decision win and stops the chain', async () => {
    const calls: string[] = [];
    const extA = extension({ extensionId: 'a', priority: 10 });
    const extB = extension({ extensionId: 'b', priority: 20 });
    const runnables = [
      runnable(extA, [
        {
          stage: 'route-request',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            calls.push('a');
            (ctx as { route: { abortRequest: (c?: string) => void } }).route.abortRequest('blockedbyclient');
          },
        },
      ]),
      runnable(extB, [
        {
          stage: 'route-request',
          options: { mode: 'mutating' },
          handler: () => {
            calls.push('b');
          },
        },
      ]),
    ];
    const { hooks, signals } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    const decision = await session.routeRequest(routeInfo);
    expect(decision).toEqual({ action: 'abort', errorCode: 'blockedbyclient' });
    expect(calls).toEqual(['a']);
    expect(signals.some((s) => s.signalType === 'route.decided')).toBe(true);
  });

  it('fulfills a request locally', async () => {
    const ext = extension({});
    const runnables = [
      runnable(ext, [
        {
          stage: 'route-request',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            (ctx as { route: { fulfillRequest: (r: unknown) => void } }).route.fulfillRequest({
              status: 204,
              body: 'stub',
            });
          },
        },
      ]),
    ];
    const session = new ChallengerRunSessionImpl(seed, runnables, makeHooks().hooks, silentLogger);
    const decision = await session.routeRequest(routeInfo);
    expect(decision).toEqual({ action: 'fulfill', response: { status: 204, body: 'stub' } });
  });

  it('fails open when a route handler throws', async () => {
    const ext = extension({});
    const runnables = [
      runnable(ext, [
        {
          stage: 'route-request',
          options: { mode: 'mutating' },
          handler: () => {
            throw new Error('boom');
          },
        },
      ]),
    ];
    const { hooks, signals } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    const decision = await session.routeRequest(routeInfo);
    expect(decision).toEqual({ action: 'continue' });
    expect(signals.some((s) => s.signalType === 'challenger.handler-error')).toBe(true);
  });

  it('filters route handlers by resource type and pattern', async () => {
    const calls: string[] = [];
    const ext = extension({});
    const runnables = [
      runnable(ext, [
        {
          stage: 'route-request',
          options: { mode: 'mutating', resourceTypes: ['image'] },
          handler: () => {
            calls.push('image-only');
          },
        },
        {
          stage: 'route-request',
          options: { mode: 'mutating', routePatterns: ['/api'] },
          handler: () => {
            calls.push('api-only');
          },
        },
      ]),
    ];
    const session = new ChallengerRunSessionImpl(seed, runnables, makeHooks().hooks, silentLogger);
    await session.routeRequest(routeInfo); // xhr to /api
    expect(calls).toEqual(['api-only']);
  });

  const responseInfo = {
    url: 'https://example.com/api',
    status: 200,
    headers: { 'content-type': 'text/html' },
    body: '<html>orig</html>',
    resourceType: 'document',
    isBinary: false,
  };

  it('reports whether response interception applies to a request', async () => {
    const withHandler = new ChallengerRunSessionImpl(
      seed,
      [
        runnable(extension({}), [
          { stage: 'route-response', options: { mode: 'mutating' }, handler: () => undefined },
        ]),
      ],
      makeHooks().hooks,
      silentLogger,
    );
    expect(withHandler.hasRouteHandlers()).toBe(true);
    expect(withHandler.responseInterceptionApplies(routeInfo)).toBe(true);

    const withoutHandler = new ChallengerRunSessionImpl(
      seed,
      [runnable(extension({}), [])],
      makeHooks().hooks,
      silentLogger,
    );
    expect(withoutHandler.responseInterceptionApplies(routeInfo)).toBe(false);
    expect(await withoutHandler.routeResponse(routeInfo, responseInfo)).toBeUndefined();
  });

  it('runs response handlers as an ordered pipeline, each seeing the prior output', async () => {
    const observedBodies: string[] = [];
    const extA = extension({ extensionId: 'a', priority: 10 });
    const extB = extension({ extensionId: 'b', priority: 20 });
    const runnables = [
      runnable(extA, [
        {
          stage: 'route-response',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            const c = ctx as {
              response: { body: string };
              respond: { modifyResponse: (p: unknown) => void };
            };
            observedBodies.push(c.response.body);
            c.respond.modifyResponse({ body: c.response.body.replace('orig', 'a') });
          },
        },
      ]),
      runnable(extB, [
        {
          stage: 'route-response',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            const c = ctx as {
              response: { body: string };
              respond: { modifyResponse: (p: unknown) => void };
            };
            observedBodies.push(c.response.body);
            c.respond.modifyResponse({
              body: c.response.body + '+b',
              headers: { 'x-b': '1' },
            });
          },
        },
      ]),
    ];
    const { hooks, signals } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    const result = await session.routeResponse(routeInfo, responseInfo);

    expect(observedBodies).toEqual(['<html>orig</html>', '<html>a</html>']);
    expect(result).toEqual({
      status: 200,
      headers: { 'content-type': 'text/html', 'x-b': '1' },
      body: '<html>a</html>+b',
    });
    expect(signals.some((s) => s.signalType === 'route.response-modified')).toBe(true);
  });

  it('returns undefined when no response handler changes anything', async () => {
    const ext = extension({});
    const runnables = [
      runnable(ext, [
        { stage: 'route-response', options: { mode: 'mutating' }, handler: () => undefined },
      ]),
    ];
    const session = new ChallengerRunSessionImpl(seed, runnables, makeHooks().hooks, silentLogger);
    expect(await session.routeResponse(routeInfo, responseInfo)).toBeUndefined();
  });

  it('fails open when a response handler throws', async () => {
    const extA = extension({ extensionId: 'a', priority: 10 });
    const extB = extension({ extensionId: 'b', priority: 20 });
    const runnables = [
      runnable(extA, [
        {
          stage: 'route-response',
          options: { mode: 'mutating' },
          handler: () => {
            throw new Error('boom');
          },
        },
      ]),
      runnable(extB, [
        {
          stage: 'route-response',
          options: { mode: 'mutating' },
          handler: (ctx: never) => {
            (ctx as { respond: { modifyResponse: (p: unknown) => void } }).respond.modifyResponse({
              status: 503,
            });
          },
        },
      ]),
    ];
    const { hooks, signals } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    const result = await session.routeResponse(routeInfo, responseInfo);
    expect(result?.status).toBe(503);
    expect(signals.some((s) => s.signalType === 'challenger.handler-error')).toBe(true);
  });

  it('validates that configured config reaches handlers', async () => {
    let observedConfig: unknown;
    const ext = extension({ configSchema: z.object({ token: z.string() }) });
    const runnables = [
      runnable(
        ext,
        [
          {
            stage: 'before-step',
            options: { mode: 'mutating' },
            handler: (ctx: never) => {
              observedConfig = (ctx as { config: unknown }).config;
            },
          },
        ],
        { token: 'abc' },
      ),
    ];

    const { hooks } = makeHooks();
    const session = new ChallengerRunSessionImpl(seed, runnables, hooks, silentLogger);
    await session.dispatch('before-step', { step: { index: 0, action: 'goto' } });
    expect(observedConfig).toEqual({ token: 'abc' });
  });
});
