import type {
  ChallengerHelperApi,
  ChallengerOutcomeOverride,
  ChallengerRuntimeContext,
  ChallengerSignal,
  SessionStatePatch,
} from '@tentacrawl/core';
import type {
  DispatchEffects,
  RunnableExtension,
  RunSessionLogger,
} from './challenger-run-session';
import { mergeContextOptions } from './challenger-run.util';

// injected rather than imported, to keep session -> factory acyclic
export interface HelperFactoryDeps {
  logger: RunSessionLogger;
  ctx: ChallengerRuntimeContext;
  emitSignal(runnable: RunnableExtension, signal: ChallengerSignal): void;
  appendArtifact(runnable: RunnableExtension, key: string, value: unknown): void;
  applySessionState(
    runnable: RunnableExtension,
    patch: SessionStatePatch,
  ): void | Promise<void>;
  setOutcomeOverride(
    runnable: RunnableExtension,
    override: ChallengerOutcomeOverride,
  ): void;
}

// Mutating operations are no-ops (warned) for observer-mode handlers.
export function createHelperApi(
  runnable: RunnableExtension,
  mode: 'mutating' | 'observer',
  effects: DispatchEffects,
  deps: HelperFactoryDeps,
): ChallengerHelperApi {
  const guard = (operation: string, apply: () => void | Promise<void>) => {
    if (mode === 'observer') {
      deps.logger.warn(
        `Challenger ${runnable.key}: observer handler attempted '${operation}', ignored`,
      );
      return undefined;
    }
    return apply();
  };

  return {
    emitSignal: (signal) => deps.emitSignal(runnable, signal),
    appendArtifact: (key, value) => deps.appendArtifact(runnable, key, value),
    dropDiscoveredLink: () =>
      guard('dropDiscoveredLink', () => {
        effects.dropLink = true;
      }),
    setProxyCandidate: (candidate) =>
      guard('setProxyCandidate', () => {
        deps.ctx.proxy = candidate;
        if (effects.contextOptions) {
          effects.contextOptions.proxy = candidate;
        }
      }),
    patchContextOptions: (patch) =>
      guard('patchContextOptions', () => {
        if (!effects.contextOptions) {
          deps.logger.warn(
            `Challenger ${runnable.key}: patchContextOptions outside bootstrap-context, ignored`,
          );
          return;
        }
        mergeContextOptions(effects.contextOptions, patch);
      }),
    setSessionState: (patch) =>
      guard('setSessionState', () => deps.applySessionState(runnable, patch)),
    requestNavigationOverride: (override) =>
      guard('requestNavigationOverride', () => {
        effects.navigationOverride = override;
      }),
    setOutcomeOverride: (override) =>
      guard('setOutcomeOverride', () => deps.setOutcomeOverride(runnable, override)),
  };
}

// Bound before any handler runs; every mutation is ignored with a warning.
export function createDetachedHelperApi(logger: RunSessionLogger): ChallengerHelperApi {
  const warn = (operation: string) => {
    logger.warn(`Challenger helper '${operation}' called outside a handler, ignored`);
  };
  return {
    emitSignal: () => warn('emitSignal'),
    appendArtifact: () => warn('appendArtifact'),
    dropDiscoveredLink: () => warn('dropDiscoveredLink'),
    setProxyCandidate: () => warn('setProxyCandidate'),
    patchContextOptions: () => warn('patchContextOptions'),
    setSessionState: () => warn('setSessionState'),
    requestNavigationOverride: () => warn('requestNavigationOverride'),
    setOutcomeOverride: () => warn('setOutcomeOverride'),
  };
}
