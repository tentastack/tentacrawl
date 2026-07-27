import type {
  ChallengerActionDefinition,
  ChallengerActionResult,
  ChallengerExtension,
  ChallengerHandlerOptions,
  ChallengerHelperApi,
  ChallengerNavigationOverride,
  ChallengerOutcomeOverride,
  ChallengerRequestInfo,
  ChallengerRequestOverride,
  ChallengerResponseHelpers,
  ChallengerResponseInfo,
  ChallengerRouteHandlerOptions,
  ChallengerRouteHelpers,
  ChallengerRuntimeContext,
  ChallengerSignal,
  ChallengerStepInfo,
  ChallengerTarget,
  ContextOptionsPatch,
  RunOutcome,
  SessionStatePatch,
} from '@tentacrawl/core';
import { challengerExtensionKey } from '@tentacrawl/core';
import type {
  ChallengerResponseResult,
  ChallengerRunSeed,
  ChallengerRunSession,
  ChallengerStage,
  ChallengerStagePatch,
  ChallengerStageResult,
  RouteDecision,
} from '@tentacrawl/browser';
import { applySessionStatePatch } from './session-state.applier';
import { createDetachedHelperApi, createHelperApi } from './challenger-helper.factory';
import { matchUrlPattern, messageOf, withTimeout } from './challenger-run.util';

export type CollectedStage = ChallengerStage | 'signal';

export interface CollectedHandler {
  stage: CollectedStage;
  handler: (ctx: never) => void | Promise<void>;
  // superset of the base options (adds routePatterns / resourceTypes)
  options: ChallengerRouteHandlerOptions;
  seq: number;
}

export interface RunnableExtension {
  extension: ChallengerExtension;
  key: string;
  handlers: CollectedHandler[];
  actions: ChallengerActionDefinition[];
  config: unknown;
  state: Map<string, unknown>;
}

export interface RunSessionLogger {
  warn(message: string): void;
  debug(message: string): void;
  error(message: string): void;
}

export interface RunEndSummary {
  participants: string[];
  outcome: RunOutcome;
  error?: Error;
  // per extension key; excludes the run-level error above (usually unrelated)
  handlerErrors: Map<string, string>;
}

export interface RunSessionHooks {
  persistSignal(extensionKey: string, signal: ChallengerSignal, seed: ChallengerRunSeed): void;
  onEnd(summary: RunEndSummary): Promise<void>;
}

export interface DispatchEffects {
  contextOptions?: ContextOptionsPatch;
  navigationOverride?: ChallengerNavigationOverride;
  dropLink?: boolean;
  failRun?: ChallengerOutcomeOverride;
}

interface HandlerInvocation {
  runnable: RunnableExtension;
  entry: CollectedHandler;
}

const MAX_SIGNAL_DEPTH = 3;
const HANDLER_ERROR_SIGNAL = 'challenger.handler-error';

export class ChallengerRunSessionImpl implements ChallengerRunSession {
  readonly ctx: ChallengerRuntimeContext;

  private readonly disabledForRun = new Set<string>();
  private readonly handlerErrors = new Map<string, string>();
  private readonly extraArtifacts: Record<string, unknown> = {};
  private readonly actionOwners = new Map<
    string,
    { def: ChallengerActionDefinition; owner: RunnableExtension }
  >();
  private outcomeOverride?: ChallengerOutcomeOverride;
  private signalDepth = 0;
  private beforeRunDone = false;
  private ended = false;

  constructor(
    private readonly seed: ChallengerRunSeed,
    private readonly extensions: RunnableExtension[],
    private readonly hooks: RunSessionHooks,
    private readonly logger: RunSessionLogger,
  ) {
    this.ctx = {
      taskId: seed.taskId,
      taskType: seed.taskType,
      workerId: seed.workerId,
      source: seed.source,
      correlationId: seed.correlationId,
      hostname: seed.hostname,
      origin: seed.origin,
      initialUrl: seed.initialUrl,
      networkPolicy: seed.networkPolicy,
      raw: {},
      state: new Map(),
      config: undefined,
      helpers: this.buildDetachedHelpers(),
    };

    for (const runnable of extensions) {
      for (const def of runnable.actions) {
        this.actionOwners.set(def.action, { def, owner: runnable });
      }
    }
  }

  hasHandlers(stage: ChallengerStage): boolean {
    return this.extensions.some(
      (e) =>
        !this.disabledForRun.has(e.key) &&
        e.handlers.some((h) => h.stage === stage),
    );
  }

  async dispatch(
    stage: ChallengerStage,
    patch: ChallengerStagePatch = {},
  ): Promise<ChallengerStageResult> {
    if (patch.raw) Object.assign(this.ctx.raw, patch.raw);

    const effects: DispatchEffects = {};
    if (stage === 'bootstrap-context') {
      effects.contextOptions = { ...patch.contextOptions };
      await this.runCoarseBeforeRun(effects);
    }

    const invocations = this.collectInvocations(stage, patch);
    const mutating = invocations.filter((i) => (i.entry.options.mode ?? 'mutating') === 'mutating');
    const observers = invocations.filter((i) => i.entry.options.mode === 'observer');

    for (const invocation of mutating) {
      if (this.disabledForRun.has(invocation.runnable.key)) continue;
      const ctx = this.buildStageContext(stage, patch, invocation.runnable, effects, 'mutating');
      await this.invokeHandler(invocation, ctx, effects);
      this.collectSettableFields(stage, ctx, effects);
    }

    await Promise.all(
      observers
        .filter((i) => !this.disabledForRun.has(i.runnable.key))
        .map((invocation) => {
          const ctx = this.buildStageContext(stage, patch, invocation.runnable, effects, 'observer');
          return this.invokeHandler(invocation, ctx, effects);
        }),
    );

    return {
      contextOptions: stage === 'bootstrap-context' ? effects.contextOptions : undefined,
      navigationOverride: effects.navigationOverride,
      outcomeOverride: this.outcomeOverride,
      dropLink: effects.dropLink,
      failRun: effects.failRun,
    };
  }

  hasRouteHandlers(): boolean {
    return this.extensions.some(
      (e) =>
        !this.disabledForRun.has(e.key) &&
        e.handlers.some((h) => h.stage === 'route-request' || h.stage === 'route-response'),
    );
  }

  async routeRequest(request: ChallengerRequestInfo): Promise<RouteDecision> {
    const invocations = this.collectRouteInvocations(
      'route-request',
      request.url,
      request.resourceType,
    );
    if (invocations.length === 0) return { action: 'continue' };

    const override: ChallengerRequestOverride = {};
    let hasOverride = false;
    let terminal: RouteDecision | undefined;
    let terminalOwner: RunnableExtension | undefined;

    for (const invocation of invocations) {
      const { runnable, entry } = invocation;
      if (this.disabledForRun.has(runnable.key)) continue;

      let localTerminal: RouteDecision | undefined;
      const routeHelpers: ChallengerRouteHelpers = {
        modifyRequest: (patch) => {
          if (patch.url !== undefined) override.url = patch.url;
          if (patch.method !== undefined) override.method = patch.method;
          if (patch.postData !== undefined) override.postData = patch.postData;
          if (patch.headers) override.headers = { ...override.headers, ...patch.headers };
          hasOverride = true;
        },
        abortRequest: (errorCode) => {
          localTerminal = { action: 'abort', errorCode };
        },
        fulfillRequest: (response) => {
          localTerminal = { action: 'fulfill', response };
        },
      };

      const ctx = {
        ...this.baseContextFor(runnable, 'mutating', {}),
        request,
        route: routeHelpers,
      };

      try {
        await withTimeout(
          Promise.resolve((entry.handler as (c: unknown) => void | Promise<void>)(ctx)),
          entry.options.timeoutMs,
          `Challenger ${runnable.key} route handler timed out after ${entry.options.timeoutMs}ms`,
        );
      } catch (err) {
        // fail open: passthrough rather than wedge the page
        this.handleHandlerError(runnable, entry.options, err, {}, 'route-request');
        continue;
      }

      if (localTerminal) {
        terminal = localTerminal;
        terminalOwner = runnable;
        break;
      }
    }

    if (terminal && terminalOwner) {
      this.emitSignal(terminalOwner, {
        signalType: 'route.decided',
        severity: 'info',
        annotations: { action: terminal.action, url: request.url },
      });
      return terminal;
    }
    return hasOverride ? { action: 'continue', override } : { action: 'continue' };
  }

  responseInterceptionApplies(request: ChallengerRequestInfo): boolean {
    return (
      this.collectRouteInvocations('route-response', request.url, request.resourceType)
        .length > 0
    );
  }

  async routeResponse(
    request: ChallengerRequestInfo,
    response: ChallengerResponseInfo,
  ): Promise<ChallengerResponseResult | undefined> {
    const invocations = this.collectRouteInvocations(
      'route-response',
      request.url,
      response.resourceType,
    );
    if (invocations.length === 0) return undefined;

    // Ordered pipeline: each handler sees the previous handler's output.
    let status = response.status;
    let headers = { ...response.headers };
    let body = response.body;
    let changed = false;
    let lastModifier: RunnableExtension | undefined;

    for (const invocation of invocations) {
      const { runnable, entry } = invocation;
      if (this.disabledForRun.has(runnable.key)) continue;

      const respond: ChallengerResponseHelpers = {
        modifyResponse: (patch) => {
          if (patch.status !== undefined) status = patch.status;
          if (patch.headers) headers = { ...headers, ...patch.headers };
          if (patch.body !== undefined) body = patch.body;
          changed = true;
          lastModifier = runnable;
        },
      };

      const ctx = {
        ...this.baseContextFor(runnable, 'mutating', {}),
        response: { ...response, status, headers, body },
        respond,
      };

      try {
        await withTimeout(
          Promise.resolve((entry.handler as (c: unknown) => void | Promise<void>)(ctx)),
          entry.options.timeoutMs,
          `Challenger ${runnable.key} response handler timed out after ${entry.options.timeoutMs}ms`,
        );
      } catch (err) {
        // fail open: serve the origin response unmodified
        this.handleHandlerError(runnable, entry.options, err, {}, 'route-response');
        continue;
      }
    }

    if (!changed) return undefined;
    if (lastModifier) {
      this.emitSignal(lastModifier, {
        signalType: 'route.response-modified',
        severity: 'info',
        annotations: { url: request.url, status },
      });
    }
    return { status, headers, body };
  }

  private collectRouteInvocations(
    stage: 'route-request' | 'route-response',
    url: string,
    resourceType: string,
  ): HandlerInvocation[] {
    const patch: ChallengerStagePatch = { requestUrl: url };
    const invocations: HandlerInvocation[] = [];
    for (const runnable of this.runnables()) {
      if (!this.targetsMatch(runnable.extension.targets, patch)) continue;
      for (const entry of runnable.handlers) {
        if (entry.stage !== stage) continue;
        if (!this.targetsMatch(entry.options.targets, patch)) continue;
        const opts = entry.options;
        if (opts.routePatterns && !opts.routePatterns.some((p) => matchUrlPattern(p, url))) {
          continue;
        }
        if (opts.resourceTypes && !opts.resourceTypes.includes(resourceType)) {
          continue;
        }
        invocations.push({ runnable, entry });
      }
    }
    return invocations.sort((a, b) => this.compareInvocations(a, b));
  }

  resolveAction(name: string): ChallengerActionDefinition | undefined {
    const entry = this.actionOwners.get(name);
    if (!entry || this.disabledForRun.has(entry.owner.key)) return undefined;
    return entry.def;
  }

  async runAction(
    name: string,
    step: ChallengerStepInfo,
  ): Promise<ChallengerActionResult | undefined> {
    const entry = this.actionOwners.get(name);
    if (!entry || this.disabledForRun.has(entry.owner.key)) return undefined;

    const ctx = {
      ...this.baseContextFor(entry.owner, 'mutating', {}),
      source: 'dsl-step' as const,
      step,
    };
    return entry.def.execute(ctx);
  }

  getActions(): ChallengerActionDefinition[] {
    return [...this.actionOwners.values()]
      .filter((entry) => !this.disabledForRun.has(entry.owner.key))
      .map((entry) => entry.def);
  }

  collectAppendedArtifacts(): Record<string, unknown> {
    return { ...this.extraArtifacts };
  }

  async end(outcome: RunOutcome, error?: Error): Promise<void> {
    if (this.ended) return;
    this.ended = true;

    for (const runnable of this.runnables()) {
      const ctx = this.baseContextFor(runnable, 'mutating', {});
      try {
        if (error && runnable.extension.onError) {
          await runnable.extension.onError(ctx, error);
        }
        await runnable.extension.afterRun?.(ctx);
      } catch (err) {
        const message = messageOf(err);
        this.handlerErrors.set(runnable.key, message);
        this.logger.warn(
          `Challenger ${runnable.key} afterRun/onError failed: ${message}`,
        );
      }
    }

    await this.hooks.onEnd({
      participants: this.extensions.map((e) => e.key),
      outcome: this.outcomeOverride?.status ?? outcome,
      error,
      handlerErrors: this.handlerErrors,
    });
  }

  private runnables(): RunnableExtension[] {
    return this.extensions.filter((e) => !this.disabledForRun.has(e.key));
  }

  private async runCoarseBeforeRun(effects: DispatchEffects): Promise<void> {
    if (this.beforeRunDone) return;
    this.beforeRunDone = true;

    for (const runnable of this.runnables()) {
      if (!runnable.extension.beforeRun) continue;
      const ctx = this.baseContextFor(runnable, 'mutating', effects);
      try {
        await runnable.extension.beforeRun(ctx);
      } catch (err) {
        this.handleHandlerError(runnable, { errorPolicy: 'warn-and-continue' }, err, effects, 'beforeRun');
      }
    }
  }

  private collectInvocations(
    stage: ChallengerStage,
    patch: ChallengerStagePatch,
  ): HandlerInvocation[] {
    const invocations: HandlerInvocation[] = [];
    for (const runnable of this.runnables()) {
      if (!this.targetsMatch(runnable.extension.targets, patch)) continue;
      for (const entry of runnable.handlers) {
        if (entry.stage !== stage) continue;
        if (!this.targetsMatch(entry.options.targets, patch)) continue;
        invocations.push({ runnable, entry });
      }
    }
    return invocations.sort((a, b) => this.compareInvocations(a, b));
  }

  private compareInvocations(a: HandlerInvocation, b: HandlerInvocation): number {
    const handlerPriority = (i: HandlerInvocation) =>
      i.entry.options.priority ?? i.runnable.extension.priority ?? 100;
    const extensionPriority = (i: HandlerInvocation) => i.runnable.extension.priority ?? 100;
    return (
      handlerPriority(a) - handlerPriority(b) ||
      extensionPriority(a) - extensionPriority(b) ||
      a.entry.seq - b.entry.seq
    );
  }

  private targetsMatch(
    targets: ChallengerTarget[] | undefined,
    patch: ChallengerStagePatch,
  ): boolean {
    if (!targets || targets.length === 0) return true;
    return targets.some((target) => this.targetMatches(target, patch));
  }

  private targetMatches(target: ChallengerTarget, patch: ChallengerStagePatch): boolean {
    if (target.taskTypes && !target.taskTypes.includes(this.seed.taskType)) {
      return false;
    }
    if (target.hostnames) {
      const hostname = this.seed.hostname?.toLowerCase();
      if (!hostname || !target.hostnames.map((h) => h.toLowerCase()).includes(hostname)) {
        return false;
      }
    }
    if (target.origins) {
      if (!this.seed.origin || !target.origins.includes(this.seed.origin)) {
        return false;
      }
    }
    if (target.urlPatterns) {
      const url =
        patch.finalUrl ??
        patch.requestedUrl ??
        patch.responseUrl ??
        patch.requestUrl ??
        this.seed.initialUrl;
      if (!url || !target.urlPatterns.some((p) => matchUrlPattern(p, url))) {
        return false;
      }
    }
    if (target.metadata) {
      const runMetadata = this.seed.metadata ?? {};
      for (const [key, value] of Object.entries(target.metadata)) {
        if (runMetadata[key] !== value) return false;
      }
    }
    return true;
  }

  private buildStageContext(
    stage: ChallengerStage,
    patch: ChallengerStagePatch,
    runnable: RunnableExtension,
    effects: DispatchEffects,
    mode: 'mutating' | 'observer',
  ): Record<string, unknown> {
    const base = this.baseContextFor(runnable, mode, effects);
    const stageFields: Record<string, unknown> = {};

    switch (stage) {
      case 'bootstrap-context':
        stageFields.contextOptions = effects.contextOptions;
        break;
      case 'before-navigation':
      case 'after-navigation':
        stageFields.requestedUrl = patch.requestedUrl;
        stageFields.finalUrl = patch.finalUrl;
        stageFields.waitUntil = patch.waitUntil;
        stageFields.step = patch.step;
        stageFields.httpStatus = patch.httpStatus;
        stageFields.error = patch.error;
        stageFields.outcomeOverride = undefined;
        break;
      case 'before-step':
      case 'after-step':
        stageFields.step = patch.step;
        stageFields.stepResult = patch.stepResult;
        break;
      case 'request':
        stageFields.requestUrl = patch.requestUrl;
        break;
      case 'response':
        stageFields.responseUrl = patch.responseUrl;
        stageFields.httpStatus = patch.httpStatus;
        stageFields.redirectedFromUrl = patch.redirectedFromUrl;
        break;
      case 'redirect':
        stageFields.fromUrl = patch.fromUrl;
        stageFields.toUrl = patch.toUrl;
        stageFields.status = patch.status;
        break;
      case 'session-snapshot':
        stageFields.session = patch.session;
        break;
      case 'artefact-collected':
      case 'discovered-link':
        stageFields.artifactKey = patch.artifactKey;
        stageFields.artifactValue = patch.artifactValue;
        stageFields.link = patch.link;
        stageFields.drop = undefined;
        break;
      case 'run-outcome':
        stageFields.outcome = patch.outcome;
        // executors pass failure text as patch.error; surface it as reason too
        stageFields.reason = patch.reason ?? patch.error;
        break;
      default:
        break;
    }

    if (patch.source) stageFields.source = patch.source;
    return { ...base, ...stageFields } as Record<string, unknown>;
  }

  private baseContextFor(
    runnable: RunnableExtension,
    mode: 'mutating' | 'observer',
    effects: DispatchEffects,
  ): ChallengerRuntimeContext {
    return {
      ...this.ctx,
      raw: this.ctx.raw,
      state: runnable.state,
      config: runnable.config,
      helpers: this.buildHelpers(runnable, mode, effects),
    };
  }

  private buildHelpers(
    runnable: RunnableExtension,
    mode: 'mutating' | 'observer',
    effects: DispatchEffects,
  ): ChallengerHelperApi {
    return createHelperApi(runnable, mode, effects, {
      logger: this.logger,
      ctx: this.ctx,
      emitSignal: (r, signal) => this.emitSignal(r, signal),
      appendArtifact: (r, key, value) => {
        this.extraArtifacts[`challenger.${r.extension.extensionId}.${key}`] = value;
      },
      applySessionState: (r, patch) => this.applySessionState(r, patch),
      setOutcomeOverride: (r, override) => this.setOutcomeOverride(r, override),
    });
  }

  private buildDetachedHelpers(): ChallengerHelperApi {
    return createDetachedHelperApi(this.logger);
  }

  private setOutcomeOverride(
    runnable: RunnableExtension,
    override: ChallengerOutcomeOverride,
  ): void {
    this.outcomeOverride = override;
    this.emitSignal(runnable, {
      signalType: 'run.outcome-overridden',
      severity: 'warn',
      annotations: { status: override.status, reason: override.reason },
    });
  }

  private async applySessionState(
    runnable: RunnableExtension,
    patch: SessionStatePatch,
  ): Promise<void> {
    try {
      await applySessionStatePatch(this.ctx.raw, patch, this.seed.initialUrl);
    } catch (err) {
      this.logger.warn(
        `Challenger ${runnable.key}: setSessionState failed: ${messageOf(err)}`,
      );
    }
  }

  private emitSignal(runnable: RunnableExtension, signal: ChallengerSignal): void {
    const enriched: ChallengerSignal = {
      timestamp: new Date().toISOString(),
      source: this.ctx.source,
      ...signal,
    };
    this.hooks.persistSignal(runnable.key, enriched, this.seed);

    if (this.signalDepth >= MAX_SIGNAL_DEPTH) return;
    this.signalDepth += 1;
    try {
      for (const listener of this.runnables()) {
        for (const entry of listener.handlers) {
          if (entry.stage !== 'signal') continue;
          const ctx = {
            ...this.baseContextFor(listener, 'observer', {}),
            signal: enriched,
          };
          try {
            const result = (entry.handler as (c: unknown) => void | Promise<void>)(ctx);
            if (result instanceof Promise) {
              result.catch((err) =>
                this.logger.warn(
                  `Challenger ${listener.key} onSignal failed: ${messageOf(err)}`,
                ),
              );
            }
          } catch (err) {
            this.logger.warn(
              `Challenger ${listener.key} onSignal failed: ${messageOf(err)}`,
            );
          }
        }
      }
    } finally {
      this.signalDepth -= 1;
    }
  }

  private collectSettableFields(
    stage: ChallengerStage,
    ctx: Record<string, unknown>,
    effects: DispatchEffects,
  ): void {
    if (
      (stage === 'before-navigation' || stage === 'after-navigation') &&
      ctx.outcomeOverride
    ) {
      this.outcomeOverride = ctx.outcomeOverride as ChallengerOutcomeOverride;
    }
    if ((stage === 'discovered-link' || stage === 'artefact-collected') && ctx.drop === true) {
      effects.dropLink = true;
    }
  }

  private async invokeHandler(
    invocation: HandlerInvocation,
    ctx: Record<string, unknown>,
    effects: DispatchEffects,
  ): Promise<void> {
    const { runnable, entry } = invocation;
    try {
      await withTimeout(
        Promise.resolve(
          (entry.handler as (c: unknown) => void | Promise<void>)(ctx),
        ),
        entry.options.timeoutMs,
        `Challenger ${runnable.key} handler timed out after ${entry.options.timeoutMs}ms`,
      );
    } catch (err) {
      this.handleHandlerError(runnable, entry.options, err, effects, entry.stage);
    }
  }

  private handleHandlerError(
    runnable: RunnableExtension,
    options: ChallengerHandlerOptions,
    err: unknown,
    effects: DispatchEffects,
    stage: string,
  ): void {
    const message = messageOf(err);
    const policy = options.errorPolicy ?? 'warn-and-continue';
    this.handlerErrors.set(runnable.key, message);
    this.logger.warn(
      `Challenger ${runnable.key} ${stage} handler error (policy=${policy}): ${message}`,
    );
    this.hooks.persistSignal(
      runnable.key,
      {
        signalType: HANDLER_ERROR_SIGNAL,
        severity: 'error',
        timestamp: new Date().toISOString(),
        source: this.ctx.source,
        annotations: { stage, policy, message },
      },
      this.seed,
    );

    if (policy === 'fail-run') {
      effects.failRun = {
        status: 'ERROR',
        reason: `Challenger ${runnable.key} failed the run: ${message}`,
      };
    } else if (policy === 'disable-extension-for-run') {
      this.disabledForRun.add(runnable.key);
    }
  }
}

export function runnableKey(ext: ChallengerExtension): string {
  return challengerExtensionKey(ext);
}
