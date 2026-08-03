import type {
  ChallengerActionDefinition,
  ChallengerNavigationContext,
  ChallengerSignal,
  ChallengerStepContext,
  ChallengerStepInfo,
} from '@tentacrawl/core';
import { CaptchaAIChallengerExtension } from '../worker/captchaai.challenger';

const TURNSTILE_PAGE = `
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
  <div class="cf-turnstile" data-sitekey="0x4AAA"></div>`;

const RECAPTCHA_V3_PAGE =
  '<script src="https://www.google.com/recaptcha/api.js?render=v3-key"></script>';

const HCAPTCHA_PAGE = `
  <div class="h-captcha" data-sitekey="hc-key"></div>
  <script src="https://js.hcaptcha.com/1/api.js"></script>`;

interface Harness {
  navigation: ChallengerNavigationContext;
  step(fields: Record<string, unknown>): ChallengerStepContext;
  signals: ChallengerSignal[];
  evaluate: jest.Mock;
}

function makeHarness(html: string, config?: unknown): Harness {
  const signals: ChallengerSignal[] = [];
  const evaluate = jest.fn().mockResolvedValue(true);
  const page = {
    url: () => 'https://example.com/login',
    content: async () => html,
    evaluate,
  };
  const base = {
    taskId: 'task-1',
    taskType: 'scrape',
    workerId: 'w-1',
    source: 'dsl-runner',
    networkPolicy: { mode: 'none' },
    raw: { page },
    state: new Map<string, unknown>(),
    config,
    helpers: {
      emitSignal: (signal: ChallengerSignal) => {
        signals.push(signal);
      },
    },
  };

  return {
    navigation: {
      ...base,
      requestedUrl: 'https://example.com/login',
      finalUrl: 'https://example.com/login',
    } as unknown as ChallengerNavigationContext,
    step: (fields) =>
      ({
        ...base,
        source: 'dsl-step',
        step: { index: 0, action: 'solveCaptcha', ...fields } as ChallengerStepInfo,
      }) as unknown as ChallengerStepContext,
    signals,
    evaluate,
  };
}

function makeSolver(overrides: Record<string, unknown> = {}) {
  return {
    configured: true,
    solveTimeoutMs: 1_000,
    solve: jest.fn().mockResolvedValue('TOKEN'),
    ...overrides,
  };
}

function captureHandlers(ext: CaptchaAIChallengerExtension) {
  let afterNavigation: ((ctx: ChallengerNavigationContext) => Promise<void>) | undefined;
  let action: ChallengerActionDefinition | undefined;
  ext.register({
    afterNavigation: (handler: unknown) => {
      afterNavigation = handler as typeof afterNavigation;
    },
    registerAction: (definition: ChallengerActionDefinition) => {
      action = definition;
    },
  } as never);
  return { afterNavigation: afterNavigation!, action: action! };
}

describe('CaptchaAIChallengerExtension', () => {
  it('registers itself with the registry and declares its capabilities', () => {
    const registry = { registerExtension: jest.fn() };
    const ext = new CaptchaAIChallengerExtension(registry as never, makeSolver() as never);

    ext.onModuleInit();

    expect(registry.registerExtension).toHaveBeenCalledWith(ext);
    expect(ext.moduleId).toBe('captchaai');
    expect(ext.extensionId).toBe('solver');
    expect(ext.capabilities).toEqual(['dsl-action', 'signal-analysis', 'user-behavior']);
  });

  it('contributes the solveCaptcha DSL action', () => {
    const ext = new CaptchaAIChallengerExtension({} as never, makeSolver() as never);
    const { action } = captureHandlers(ext);

    expect(action.action).toBe('solveCaptcha');
    expect(action.schema.safeParse({ action: 'solveCaptcha', type: 'turnstile' }).success).toBe(
      true,
    );
  });

  it('reports a detected challenge without solving it when auto-solve is off', async () => {
    const solver = makeSolver();
    const ext = new CaptchaAIChallengerExtension({} as never, solver as never);
    const { afterNavigation } = captureHandlers(ext);
    const harness = makeHarness(TURNSTILE_PAGE);

    await afterNavigation(harness.navigation);

    expect(solver.solve).not.toHaveBeenCalled();
    expect(harness.signals).toContainEqual(
      expect.objectContaining({
        signalType: 'page.captcha-suspected',
        severity: 'info',
        annotations: expect.objectContaining({ kind: 'turnstile', sitekey: '0x4AAA' }),
      }),
    );
  });

  it('solves and injects the token when auto-solve is enabled', async () => {
    const solver = makeSolver();
    const ext = new CaptchaAIChallengerExtension({} as never, solver as never);
    const { afterNavigation } = captureHandlers(ext);
    const harness = makeHarness(TURNSTILE_PAGE, { autoSolve: true });

    await afterNavigation(harness.navigation);

    expect(solver.solve).toHaveBeenCalledWith({
      kind: 'turnstile',
      sitekey: '0x4AAA',
      pageurl: 'https://example.com/login',
      action: undefined,
    });
    expect(harness.evaluate).toHaveBeenCalled();
    expect(harness.signals).toContainEqual(
      expect.objectContaining({ signalType: 'captchaai.solved' }),
    );
  });

  it('never sends unsupported challenge families to CaptchaAI', async () => {
    const solver = makeSolver();
    const ext = new CaptchaAIChallengerExtension({} as never, solver as never);
    const { afterNavigation } = captureHandlers(ext);
    const harness = makeHarness(HCAPTCHA_PAGE, { autoSolve: true });

    await afterNavigation(harness.navigation);

    expect(solver.solve).not.toHaveBeenCalled();
    expect(harness.signals).toContainEqual(
      expect.objectContaining({
        signalType: 'captchaai.unsupported-challenge',
        severity: 'warn',
        annotations: expect.objectContaining({ kind: 'hcaptcha' }),
      }),
    );
  });

  it('emits a signal instead of solving when no API key is configured', async () => {
    const solver = makeSolver({ configured: false });
    const ext = new CaptchaAIChallengerExtension({} as never, solver as never);
    const { afterNavigation } = captureHandlers(ext);
    const harness = makeHarness(TURNSTILE_PAGE, { autoSolve: true });

    await afterNavigation(harness.navigation);

    expect(solver.solve).not.toHaveBeenCalled();
    expect(harness.signals).toContainEqual(
      expect.objectContaining({ signalType: 'captchaai.not-configured' }),
    );
  });

  it('solves an explicitly typed step and returns the token as the step output', async () => {
    const solver = makeSolver();
    const ext = new CaptchaAIChallengerExtension({} as never, solver as never);
    const { action } = captureHandlers(ext);
    const harness = makeHarness('<html></html>');

    const result = await action.execute(
      harness.step({ type: 'recaptcha-v2', sitekey: 'k1', invisible: true }),
    );

    expect(result).toEqual({ output: 'TOKEN' });
    expect(solver.solve).toHaveBeenCalledWith({
      kind: 'recaptcha-v2',
      sitekey: 'k1',
      pageurl: 'https://example.com/login',
      invisible: true,
    });
  });

  it('falls back to the configured action and min score for reCAPTCHA v3', async () => {
    const solver = makeSolver();
    const ext = new CaptchaAIChallengerExtension({} as never, solver as never);
    const { action } = captureHandlers(ext);
    const harness = makeHarness(RECAPTCHA_V3_PAGE, {
      recaptchaV3Action: 'checkout',
      recaptchaV3MinScore: 0.9,
    });

    await action.execute(harness.step({ type: 'auto' }));

    expect(solver.solve).toHaveBeenCalledWith({
      kind: 'recaptcha-v3',
      sitekey: 'v3-key',
      pageurl: 'https://example.com/login',
      action: 'checkout',
      minScore: 0.9,
    });
  });

  it('fails the step with an explicit unsupported error on an hCaptcha page', async () => {
    const solver = makeSolver();
    const ext = new CaptchaAIChallengerExtension({} as never, solver as never);
    const { action } = captureHandlers(ext);
    const harness = makeHarness(HCAPTCHA_PAGE);

    const result = await action.execute(harness.step({ type: 'auto' }));

    expect(solver.solve).not.toHaveBeenCalled();
    expect(result.preconditionFailed).toBe(true);
    expect(result.error).toContain('hcaptcha');
  });

  it('fails the step when no API key is configured', async () => {
    const solver = makeSolver({ configured: false });
    const ext = new CaptchaAIChallengerExtension({} as never, solver as never);
    const { action } = captureHandlers(ext);
    const harness = makeHarness(TURNSTILE_PAGE);

    const result = await action.execute(harness.step({ type: 'auto' }));

    expect(result).toMatchObject({ preconditionFailed: true });
    expect(result.error).toContain('CAPTCHAAI_API_KEY');
  });

  it('reports solve failures as a step error and a signal', async () => {
    const solver = makeSolver({ solve: jest.fn().mockRejectedValue(new Error('boom')) });
    const ext = new CaptchaAIChallengerExtension({} as never, solver as never);
    const { action } = captureHandlers(ext);
    const harness = makeHarness(TURNSTILE_PAGE);

    const result = await action.execute(harness.step({ type: 'auto' }));

    expect(result.error).toBe('boom');
    expect(harness.signals).toContainEqual(
      expect.objectContaining({ signalType: 'captchaai.solve-failed' }),
    );
  });
});
