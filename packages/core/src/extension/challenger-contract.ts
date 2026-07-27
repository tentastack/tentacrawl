import type { ZodSchema } from 'zod';
import type { PageLink } from '../schema';
import type { RunOutcome } from '../schema/enums';
import type { NetworkPolicy } from '../schema/network-policy.schema';

export type ChallengerTaskType = 'scrape' | 'crawl-page';
export type ChallengerSource =
  | 'dsl-runner'
  | 'scrape-simple'
  | 'crawl-page'
  | 'dsl-step';

export type ChallengerCapability =
  | 'proxy'
  | 'session'
  | 'fingerprint'
  | 'navigation'
  | 'signal-analysis'
  | 'artifact-analysis'
  | 'user-behavior'
  | 'dsl-action'
  | 'request-intercept'
  | 'response-intercept';

export const CHALLENGER_CAPABILITIES: ChallengerCapability[] = [
  'proxy',
  'session',
  'fingerprint',
  'navigation',
  'signal-analysis',
  'artifact-analysis',
  'user-behavior',
  'dsl-action',
  'request-intercept',
  'response-intercept',
];

export interface ChallengerTarget {
  hostnames?: string[];
  origins?: string[];
  urlPatterns?: string[];
  taskTypes?: ChallengerTaskType[];
  metadata?: Record<string, string>;
}

// points to a module endpoint listing selectable options; see docs/proxy-module-spec.md
export interface ChallengerSelectionDescriptor {
  capability: ChallengerCapability;
  optionsPath: string;
  autoLabel?: string;
}

export interface ChallengerSelectionOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface ChallengerProxyCandidate {
  server: string;
  username?: string;
  password?: string;
  id?: string;
}

export interface ChallengerRawState {
  browser?: unknown;
  context?: unknown;
  page?: unknown;
  request?: unknown;
  response?: unknown;
}

export interface ChallengerRuntimeContext {
  taskId: string;
  taskType: ChallengerTaskType;
  workerId: string;
  source: ChallengerSource;
  correlationId?: string;
  hostname?: string;
  origin?: string;
  initialUrl?: string;
  networkPolicy: NetworkPolicy;
  proxy?: ChallengerProxyCandidate;
  raw: ChallengerRawState;
  state: Map<string, unknown>;
  config: unknown;
  helpers: ChallengerHelperApi;
}

export interface ContextOptionsPatch {
  proxy?: ChallengerProxyCandidate;
  stealth?: Record<string, unknown>;
  locale?: string;
  timezone?: string;
  headers?: Record<string, string>;
  launchArgs?: string[];
  initScripts?: Array<{ name: string; source: string }>;
}

export interface SessionStatePatch {
  cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>;
  removeCookies?: string[];
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
  extraHeaders?: Record<string, string>;
}

export interface ChallengerNavigationOverride {
  action: 'continue' | 'retry' | 'abort' | 'delay';
  reason?: string;
  delayMs?: number;
}

export interface ChallengerOutcomeOverride {
  status: RunOutcome;
  reason: string;
}

export const BUILT_IN_CHALLENGER_SIGNAL_TYPES = [
  'network.blocked',
  'network.redirect-loop',
  'network.challenge-header',
  'session.cookies-changed',
  'session.storage-changed',
  'page.captcha-suspected',
  'page.interstitial-detected',
  'page.login-required',
  'page.unusual-fingerprint-feedback',
  'run.outcome-overridden',
  'route.decided',
  'route.response-modified',
] as const;

export type ChallengerSignalType =
  | (typeof BUILT_IN_CHALLENGER_SIGNAL_TYPES)[number]
  | (string & {});

export type ChallengerSignalSeverity = 'info' | 'warn' | 'error';

export interface ChallengerSignal {
  signalType: ChallengerSignalType;
  severity: ChallengerSignalSeverity;
  timestamp?: string;
  source?: ChallengerSource;
  evidence?: unknown;
  requestId?: string;
  responseId?: string;
  annotations?: Record<string, unknown>;
}

export interface ChallengerHelperApi {
  emitSignal(signal: ChallengerSignal): void | Promise<void>;
  appendArtifact(key: string, value: unknown): void | Promise<void>;
  dropDiscoveredLink(reason?: string): void | Promise<void>;
  setProxyCandidate(c: ChallengerProxyCandidate): void | Promise<void>;
  patchContextOptions(p: Partial<ContextOptionsPatch>): void | Promise<void>;
  setSessionState(p: SessionStatePatch): void | Promise<void>;
  requestNavigationOverride(o: ChallengerNavigationOverride): void | Promise<void>;
  setOutcomeOverride(o: ChallengerOutcomeOverride): void | Promise<void>;
}

export interface ChallengerBootstrapContext extends ChallengerRuntimeContext {
  contextOptions: ContextOptionsPatch;
}

export type ChallengerPageContext = ChallengerRuntimeContext;

export interface ChallengerRequestContext extends ChallengerRuntimeContext {
  requestUrl?: string;
}

export interface ChallengerResponseContext extends ChallengerRuntimeContext {
  responseUrl?: string;
  httpStatus?: number;
  redirectedFromUrl?: string;
}

export interface ChallengerRedirectContext extends ChallengerRuntimeContext {
  fromUrl: string;
  toUrl: string;
  status?: number;
}

export interface ChallengerStepInfo {
  index: number;
  action: string;
  [k: string]: unknown;
}

export interface ChallengerStepResultInfo {
  index: number;
  action: string;
  durationMs: number;
  httpStatus?: number;
  error?: string;
}

export interface ChallengerNavigationContext extends ChallengerRuntimeContext {
  requestedUrl: string;
  finalUrl?: string;
  waitUntil?: string;
  step?: ChallengerStepInfo;
  httpStatus?: number;
  error?: string;
  outcomeOverride?: ChallengerOutcomeOverride;
}

export interface ChallengerStepContext extends ChallengerRuntimeContext {
  step: ChallengerStepInfo;
  stepResult?: ChallengerStepResultInfo;
}

export interface ChallengerSessionSnapshot {
  cookies: Array<{ name: string; value: string; domain?: string; path?: string }>;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  requestHeaders: Record<string, string>;
}

export interface ChallengerSessionContext extends ChallengerRuntimeContext {
  session: ChallengerSessionSnapshot;
}

export interface ChallengerSignalContext extends ChallengerRuntimeContext {
  signal: ChallengerSignal;
}

export interface ChallengerArtifactContext extends ChallengerRuntimeContext {
  artifactKey?: string;
  artifactValue?: unknown;
  link?: PageLink;
  drop?: boolean;
}

export interface ChallengerRunOutcomeContext extends ChallengerRuntimeContext {
  outcome: RunOutcome;
  reason?: string;
  error?: Error;
}

// request-intercept capability: unlike onRequest, can rewrite/block/fulfill; see docs/request-interception-spec.md
export interface ChallengerRequestInfo {
  url: string;
  method: string;
  resourceType: string;
  headers: Record<string, string>;
  postData?: string;
  isNavigationRequest: boolean;
}

export interface ChallengerRequestOverride {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  postData?: string;
}

export interface ChallengerFulfillResponse {
  status?: number;
  headers?: Record<string, string>;
  contentType?: string;
  body?: string;
}

export interface ChallengerRouteHelpers {
  modifyRequest(patch: ChallengerRequestOverride): void;
  abortRequest(errorCode?: string): void;
  fulfillRequest(response: ChallengerFulfillResponse): void;
}

export interface ChallengerRouteContext extends ChallengerRuntimeContext {
  request: ChallengerRequestInfo;
  route: ChallengerRouteHelpers;
}

// response-intercept: ordered pipeline, each handler sees the prior one's output; binary bodies pass through untouched
export interface ChallengerResponseInfo {
  url: string;
  status: number;
  headers: Record<string, string>;
  body?: string;
  resourceType: string;
  isBinary: boolean;
}

export interface ChallengerResponsePatch {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
}

export interface ChallengerResponseHelpers {
  modifyResponse(patch: ChallengerResponsePatch): void;
}

export interface ChallengerResponseInterceptContext extends ChallengerRuntimeContext {
  response: ChallengerResponseInfo;
  respond: ChallengerResponseHelpers;
}

export type ChallengerHandlerMode = 'mutating' | 'observer';
export type ChallengerErrorPolicy =
  | 'fail-run'
  | 'warn-and-continue'
  | 'disable-extension-for-run';

export interface ChallengerHandlerOptions {
  mode?: ChallengerHandlerMode;
  priority?: number;
  timeoutMs?: number;
  errorPolicy?: ChallengerErrorPolicy;
  targets?: ChallengerTarget[];
}

export interface ChallengerRouteHandlerOptions extends ChallengerHandlerOptions {
  routePatterns?: string[];
  resourceTypes?: string[];
}

export type ChallengerHandler<T> = (ctx: T) => void | Promise<void>;

export interface ChallengerActionDefinition {
  action: string;
  schema: ZodSchema;
  compile?(step: unknown): unknown;
  execute(ctx: ChallengerStepContext): Promise<ChallengerActionResult>;
}

export interface ChallengerActionResult {
  output?: unknown;
  httpStatus?: number;
  error?: string;
  preconditionFailed?: boolean;
}

export interface ChallengerRegistrar {
  onBootstrapContext(
    h: ChallengerHandler<ChallengerBootstrapContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  onCreatePage(
    h: ChallengerHandler<ChallengerPageContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  beforeNavigation(
    h: ChallengerHandler<ChallengerNavigationContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  afterNavigation(
    h: ChallengerHandler<ChallengerNavigationContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  beforeStep(
    h: ChallengerHandler<ChallengerStepContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  afterStep(
    h: ChallengerHandler<ChallengerStepContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  onRequest(
    h: ChallengerHandler<ChallengerRequestContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  onResponse(
    h: ChallengerHandler<ChallengerResponseContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  onRedirect(
    h: ChallengerHandler<ChallengerRedirectContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  onSessionSnapshot(
    h: ChallengerHandler<ChallengerSessionContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  onSignal(
    h: ChallengerHandler<ChallengerSignalContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  onArtefactCollected(
    h: ChallengerHandler<ChallengerArtifactContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  onDiscoveredLink(
    h: ChallengerHandler<ChallengerArtifactContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  onRunOutcome(
    h: ChallengerHandler<ChallengerRunOutcomeContext>,
    o?: ChallengerHandlerOptions,
  ): void;
  interceptRequest(
    h: ChallengerHandler<ChallengerRouteContext>,
    o?: ChallengerRouteHandlerOptions,
  ): void;
  interceptResponse(
    h: ChallengerHandler<ChallengerResponseInterceptContext>,
    o?: ChallengerRouteHandlerOptions,
  ): void;
  registerAction(action: ChallengerActionDefinition): void;
}

export interface ChallengerExtension {
  readonly moduleId: string;
  readonly extensionId: string;
  readonly version: string;
  readonly priority?: number;
  readonly capabilities: ChallengerCapability[];
  readonly targets?: ChallengerTarget[];
  readonly configSchema?: ZodSchema;
  readonly selection?: ChallengerSelectionDescriptor;
  register?(registrar: ChallengerRegistrar): void;
  beforeRun?(ctx: ChallengerRuntimeContext): Promise<void>;
  afterRun?(ctx: ChallengerRuntimeContext): Promise<void>;
  onError?(ctx: ChallengerRuntimeContext, error: Error): Promise<void>;
}

export function challengerExtensionKey(ext: Pick<ChallengerExtension, 'moduleId' | 'extensionId'>): string {
  return `${ext.moduleId}/${ext.extensionId}`;
}
