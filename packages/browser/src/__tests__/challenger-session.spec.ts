import type { CompileResult } from '@tentacrawl/dsl';
import type {
  ChallengerActionDefinition,
  ChallengerRuntimeContext,
} from '@tentacrawl/core';
import type {
  ChallengerRunSession,
  ChallengerStage,
  ChallengerStagePatch,
  ChallengerStageResult,
} from '../port/challenger-dispatcher';

const mockLocator = {
  click: jest.fn().mockResolvedValue(undefined),
  fill: jest.fn().mockResolvedValue(undefined),
  innerText: jest.fn().mockResolvedValue('text'),
  innerHTML: jest.fn().mockResolvedValue('<div>content</div>'),
  getAttribute: jest.fn().mockResolvedValue('attr'),
  count: jest.fn().mockResolvedValue(1),
};

const mockPage = {
  goto: jest.fn().mockResolvedValue({ status: () => 200 }),
  url: jest.fn().mockReturnValue('https://example.com/final'),
  click: jest.fn().mockResolvedValue(undefined),
  on: jest.fn().mockReturnThis(),
  context: jest.fn(),
  waitForSelector: jest.fn().mockResolvedValue(undefined),
  locator: jest.fn().mockReturnValue(mockLocator),
  screenshot: jest.fn().mockResolvedValue(Buffer.from('png')),
  content: jest.fn().mockResolvedValue('<!DOCTYPE html><html></html>'),
  evaluate: jest.fn().mockResolvedValue({ localStorage: {}, sessionStorage: {} }),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockContext = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  addInitScript: jest.fn().mockResolvedValue(undefined),
  cookies: jest.fn().mockResolvedValue([]),
  close: jest.fn().mockResolvedValue(undefined),
};
mockPage.context.mockReturnValue(mockContext);

const mockBrowser = {
  isConnected: jest.fn().mockReturnValue(true),
  newContext: jest.fn().mockResolvedValue(mockContext),
  on: jest.fn().mockReturnThis(),
  contexts: jest.fn().mockReturnValue([]),
};

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue(mockBrowser),
  },
}));

import { runDsl } from '../runner';
import { discoverLinks } from '../link-discovery';
import { collectArtefacts } from '../format-pipeline';

interface FakeSessionOptions {
  stages?: Partial<Record<ChallengerStage, ChallengerStageResult>>;
  handledStages?: ChallengerStage[];
  actions?: ChallengerActionDefinition[];
}

function makeFakeSession(options: FakeSessionOptions = {}) {
  const dispatched: Array<{ stage: ChallengerStage; patch?: ChallengerStagePatch }> = [];
  const actionMap = new Map((options.actions ?? []).map((a) => [a.action, a]));
  const ctx: ChallengerRuntimeContext = {
    taskId: 't-1',
    taskType: 'scrape',
    workerId: 'w-1',
    source: 'dsl-runner',
    networkPolicy: { mode: 'none' },
    raw: {},
    state: new Map(),
    config: undefined,
    helpers: {
      emitSignal: jest.fn(),
      appendArtifact: jest.fn(),
      dropDiscoveredLink: jest.fn(),
      setProxyCandidate: jest.fn(),
      patchContextOptions: jest.fn(),
      setSessionState: jest.fn(),
      requestNavigationOverride: jest.fn(),
      setOutcomeOverride: jest.fn(),
    },
  };

  const session: ChallengerRunSession = {
    ctx,
    hasHandlers: (stage) =>
      options.handledStages ? options.handledStages.includes(stage) : true,
    dispatch: jest.fn(async (stage: ChallengerStage, patch?: ChallengerStagePatch) => {
      dispatched.push({ stage, patch });
      return options.stages?.[stage] ?? {};
    }),
    hasRouteHandlers: () => false,
    routeRequest: async () => ({ action: 'continue' as const }),
    responseInterceptionApplies: () => false,
    routeResponse: async () => undefined,
    resolveAction: (name) => actionMap.get(name),
    runAction: async (name, step) => {
      const def = actionMap.get(name);
      if (!def) return undefined;
      return def.execute({ ...ctx, step });
    },
    getActions: () => [...actionMap.values()],
    collectAppendedArtifacts: () => ({}),
    end: jest.fn().mockResolvedValue(undefined),
  };

  return { session, dispatched };
}

const compiled: CompileResult = {
  name: 'test',
  steps: [
    { index: 0, action: 'goto', value: 'https://example.com' },
    { index: 1, action: 'extract', selector: '#content', outputKey: 'main' },
  ],
};

describe('runDsl with a challenger session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPage.goto.mockResolvedValue({ status: () => 200 });
    mockPage.url.mockReturnValue('https://example.com/final');
    mockPage.context.mockReturnValue(mockContext);
  });

  it('dispatches lifecycle stages in order', async () => {
    const { session, dispatched } = makeFakeSession({ handledStages: [] });
    const result = await runDsl(compiled, { workerId: 'w-1', session });

    expect(result.status).toBe('OK');
    const stages = dispatched.map((d) => d.stage);
    expect(stages).toEqual([
      'bootstrap-context',
      'create-page',
      'before-step',
      'before-navigation',
      'after-navigation',
      'after-step',
      'before-step',
      'after-step',
    ]);
  });

  it('applies a bootstrap context options patch', async () => {
    const { session } = makeFakeSession({
      handledStages: [],
      stages: {
        'bootstrap-context': {
          contextOptions: {
            proxy: { server: 'http://challenger-proxy:9999' },
            headers: { 'X-Challenger': 'on' },
            initScripts: [{ name: 'probe', source: 'window.__probe = true;' }],
          },
        },
      },
    });

    await runDsl(compiled, { workerId: 'w-1', session });

    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        proxy: expect.objectContaining({ server: 'http://challenger-proxy:9999' }),
        extraHTTPHeaders: expect.objectContaining({ 'X-Challenger': 'on' }),
      }),
    );
    expect(mockContext.addInitScript).toHaveBeenCalledWith({
      content: 'window.__probe = true;',
    });
  });

  it('aborts navigation when an override requests it', async () => {
    const { session } = makeFakeSession({
      handledStages: [],
      stages: {
        'after-navigation': {
          navigationOverride: { action: 'abort', reason: 'blocked interstitial' },
        },
      },
    });

    const result = await runDsl(compiled, { workerId: 'w-1', session });
    expect(result.status).toBe('ERROR');
    expect(result.trace.steps[0].error).toContain('blocked interstitial');
  });

  it('retries navigation when an override requests it', async () => {
    const { session } = makeFakeSession({ handledStages: [] });
    let retried = false;
    jest.mocked(session.dispatch).mockImplementation(async (stage) => {
      if (stage === 'after-navigation' && !retried) {
        retried = true;
        return { navigationOverride: { action: 'retry' } };
      }
      return {};
    });

    const result = await runDsl(compiled, { workerId: 'w-1', session });
    expect(result.status).toBe('OK');
    expect(mockPage.goto).toHaveBeenCalledTimes(2);
  });

  it('fails the run when a stage result demands it', async () => {
    const { session } = makeFakeSession({
      handledStages: [],
      stages: {
        'before-step': { failRun: { status: 'BLOCKED', reason: 'capability gate' } },
      },
    });

    const result = await runDsl(compiled, { workerId: 'w-1', session });
    expect(result.status).toBe('BLOCKED');
    expect(result.trace.steps).toHaveLength(0);
  });

  it('executes a challenger-contributed action', async () => {
    const execute = jest.fn().mockResolvedValue({ output: 'captcha-token' });
    const { session } = makeFakeSession({
      handledStages: [],
      actions: [
        {
          action: 'solveCaptcha',
          schema: {} as never,
          execute,
        },
      ],
    });

    const withAction: CompileResult = {
      name: 'captcha',
      steps: [
        {
          index: 0,
          action: 'solveCaptcha',
          selector: '#captcha',
          outputKey: 'token',
          fields: { vendor: 'turnstile' },
        },
      ],
    };

    const result = await runDsl(withAction, { workerId: 'w-1', session });
    expect(result.status).toBe('OK');
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        step: expect.objectContaining({ action: 'solveCaptcha', vendor: 'turnstile' }),
      }),
    );
    expect(result.artifacts['token']).toBe('captcha-token');
  });

  it('still reports unknown actions without a session', async () => {
    const withUnknown: CompileResult = {
      name: 'unknown',
      steps: [{ index: 0, action: 'solveCaptcha' }],
    };
    const result = await runDsl(withUnknown, { workerId: 'w-1' });
    expect(result.status).toBe('ERROR');
    expect(result.trace.steps[0].error).toContain('Unknown action');
  });
});

describe('discoverLinks with a challenger session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('drops links when the stage result requests it', async () => {
    mockPage.evaluate.mockResolvedValueOnce([
      { href: 'https://example.com/keep', text: 'Keep' },
      { href: 'https://example.com/drop', text: 'Drop' },
    ]);
    const { session } = makeFakeSession({ handledStages: ['discovered-link'] });
    jest.mocked(session.dispatch).mockImplementation(async (_stage, patch) => {
      return { dropLink: patch?.link?.url.includes('/drop') };
    });

    const links = await discoverLinks(
      mockPage as never,
      'https://example.com',
      session,
    );
    expect(links.map((l) => l.url)).toEqual(['https://example.com/keep']);
  });
});

describe('collectArtefacts with a challenger session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches artefact-collected per key', async () => {
    const { session, dispatched } = makeFakeSession({
      handledStages: ['artefact-collected'],
    });
    mockPage.content.mockResolvedValue('<html><body>hi</body></html>');

    await collectArtefacts(mockPage as never, ['html', 'markdown'], 'https://example.com', session);

    const keys = dispatched
      .filter((d) => d.stage === 'artefact-collected')
      .map((d) => d.patch?.artifactKey);
    expect(keys).toEqual(['html', 'markdown']);
  });
});
