export {
  getStealthDefaults,
  buildAcceptLanguage,
  generateStealthSeed,
  getStealthInitScripts,
  STEALTH_INIT_SCRIPTS,
  USER_AGENTS,
  VIEWPORTS,
} from './stealth';
export type { StealthDefaults, StealthSeed, StealthInitScript } from './stealth';

export {
  getOrCreateBrowser,
  closeBrowser,
  browserPoolSize,
} from './browser-pool';
export { createHardenedContext } from './context-factory';
export type { ProxyConfig, ContextOptions } from './context-factory';

export { executeStep, toStepInfo } from './step-executor';
export type { StepResult } from './step-executor';

export { runDsl } from './runner';
export type { RunnerResult, RunnerOptions, DebugScreenshotConfig } from './runner';

export { htmlToMarkdown } from './markdown';
export { extractMetadata } from './metadata';
export { discoverLinks, normalizeDiscoveredUrl } from './link-discovery';
export { collectArtefacts } from './format-pipeline';

export { NoopChallengerDispatcher } from './port/challenger-dispatcher';
export type {
  ChallengerDispatcher,
  ChallengerRunSeed,
  ChallengerRunSession,
  ChallengerStage,
  ChallengerStagePatch,
  ChallengerStageResult,
  ChallengerRawPatch,
  RouteDecision,
  ChallengerResponseResult,
} from './port/challenger-dispatcher';
export {
  instrumentPage,
  navigateWithChallenger,
  dispatchSessionSnapshot,
  captureSessionSnapshot,
} from './challenger-integration';
export type { ChallengerNavigationResult } from './challenger-integration';
