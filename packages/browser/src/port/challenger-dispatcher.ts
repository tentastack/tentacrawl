import type {
  ChallengerActionDefinition,
  ChallengerActionResult,
  ChallengerFulfillResponse,
  ChallengerHelperApi,
  ChallengerNavigationOverride,
  ChallengerOutcomeOverride,
  ChallengerRequestInfo,
  ChallengerRequestOverride,
  ChallengerResponseInfo,
  ChallengerRuntimeContext,
  ChallengerSessionSnapshot,
  ChallengerSource,
  ChallengerStepInfo,
  ChallengerStepResultInfo,
  ChallengerTaskType,
  ContextOptionsPatch,
  NetworkPolicy,
  PageLink,
  RunOutcome,
} from '@tentacrawl/core';

export type ChallengerStage =
  | 'bootstrap-context'
  | 'create-page'
  | 'before-navigation'
  | 'after-navigation'
  | 'before-step'
  | 'after-step'
  | 'request'
  | 'response'
  | 'redirect'
  | 'route-request'
  | 'route-response'
  | 'session-snapshot'
  | 'artefact-collected'
  | 'discovered-link'
  | 'run-outcome';

export type RouteDecision =
  | { action: 'continue'; override?: ChallengerRequestOverride }
  | { action: 'abort'; errorCode?: string }
  | { action: 'fulfill'; response: ChallengerFulfillResponse };

// undefined return from routeResponse means "no change"
export interface ChallengerResponseResult {
  status: number;
  headers: Record<string, string>;
  body?: string;
}

export interface ChallengerRunSeed {
  taskId: string;
  taskType: ChallengerTaskType;
  workerId: string;
  source: ChallengerSource;
  correlationId?: string;
  hostname?: string;
  origin?: string;
  initialUrl?: string;
  networkPolicy: NetworkPolicy;
  metadata?: Record<string, string>;
}

export interface ChallengerRawPatch {
  browser?: unknown;
  context?: unknown;
  page?: unknown;
  request?: unknown;
  response?: unknown;
}

export interface ChallengerStagePatch {
  source?: ChallengerSource;
  raw?: ChallengerRawPatch;
  contextOptions?: ContextOptionsPatch;
  requestedUrl?: string;
  finalUrl?: string;
  waitUntil?: string;
  httpStatus?: number;
  error?: string;
  step?: ChallengerStepInfo;
  stepResult?: ChallengerStepResultInfo;
  requestUrl?: string;
  responseUrl?: string;
  redirectedFromUrl?: string;
  fromUrl?: string;
  toUrl?: string;
  status?: number;
  session?: ChallengerSessionSnapshot;
  artifactKey?: string;
  artifactValue?: unknown;
  link?: PageLink;
  outcome?: RunOutcome;
  reason?: string;
}

export interface ChallengerStageResult {
  contextOptions?: ContextOptionsPatch;
  navigationOverride?: ChallengerNavigationOverride;
  outcomeOverride?: ChallengerOutcomeOverride;
  dropLink?: boolean;
  failRun?: ChallengerOutcomeOverride;
}

export interface ChallengerRunSession {
  readonly ctx: ChallengerRuntimeContext;
  hasHandlers(stage: ChallengerStage): boolean;
  dispatch(stage: ChallengerStage, patch?: ChallengerStagePatch): Promise<ChallengerStageResult>;
  hasRouteHandlers(): boolean;
  routeRequest(request: ChallengerRequestInfo): Promise<RouteDecision>;
  responseInterceptionApplies(request: ChallengerRequestInfo): boolean;
  routeResponse(
    request: ChallengerRequestInfo,
    response: ChallengerResponseInfo,
  ): Promise<ChallengerResponseResult | undefined>;
  resolveAction(name: string): ChallengerActionDefinition | undefined;
  runAction(name: string, step: ChallengerStepInfo): Promise<ChallengerActionResult | undefined>;
  getActions(): ChallengerActionDefinition[];
  collectAppendedArtifacts(): Record<string, unknown>;
  end(outcome: RunOutcome, error?: Error): Promise<void>;
}

export interface ChallengerDispatcher {
  beginRun(seed: ChallengerRunSeed): Promise<ChallengerRunSession>;
}

const noopHelpers: ChallengerHelperApi = {
  emitSignal: () => undefined,
  appendArtifact: () => undefined,
  dropDiscoveredLink: () => undefined,
  setProxyCandidate: () => undefined,
  patchContextOptions: () => undefined,
  setSessionState: () => undefined,
  requestNavigationOverride: () => undefined,
  setOutcomeOverride: () => undefined,
};

class NoopChallengerRunSession implements ChallengerRunSession {
  readonly ctx: ChallengerRuntimeContext;

  constructor(seed: ChallengerRunSeed) {
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
      helpers: noopHelpers,
    };
  }

  hasHandlers(): boolean {
    return false;
  }

  async dispatch(): Promise<ChallengerStageResult> {
    return {};
  }

  hasRouteHandlers(): boolean {
    return false;
  }

  async routeRequest(): Promise<RouteDecision> {
    return { action: 'continue' };
  }

  responseInterceptionApplies(): boolean {
    return false;
  }

  async routeResponse(): Promise<ChallengerResponseResult | undefined> {
    return undefined;
  }

  resolveAction(): ChallengerActionDefinition | undefined {
    return undefined;
  }

  async runAction(): Promise<ChallengerActionResult | undefined> {
    return undefined;
  }

  getActions(): ChallengerActionDefinition[] {
    return [];
  }

  collectAppendedArtifacts(): Record<string, unknown> {
    return {};
  }

  async end(): Promise<void> {
    return undefined;
  }
}

export class NoopChallengerDispatcher implements ChallengerDispatcher {
  async beginRun(seed: ChallengerRunSeed): Promise<ChallengerRunSession> {
    return new NoopChallengerRunSession(seed);
  }
}
