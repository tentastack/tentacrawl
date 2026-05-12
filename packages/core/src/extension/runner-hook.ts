import type { PageLink } from '../schema';
import type { RunOutcome } from '../schema/enums';
import type { NetworkPolicy } from '../schema/network-policy.schema';

export type TaskType = 'scrape' | 'crawl-page';
export type BrowserHookSource = 'dsl-runner' | 'scrape-simple' | 'crawl-page';

export interface RunHookContext {
  taskId: string;
  taskType: TaskType;
  workerId: string;
  correlationId?: string;
  hostname?: string;
  origin?: string;
  networkPolicy: NetworkPolicy;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
    id?: string;
  };
  hookData: Map<string, unknown>;
}

export interface StepHookContext {
  run?: RunHookContext;
  page: unknown;
  step: { index: number; action: string; [k: string]: unknown };
  stepResult?: {
    index: number;
    action: string;
    durationMs: number;
    httpStatus?: number;
    error?: string;
  };
  abort?: {
    status: RunOutcome;
    reason: string;
  };
}

export interface HookOutcomeOverride {
  status: RunOutcome;
  reason: string;
}

export interface PageHookContext {
  run?: RunHookContext;
  page: unknown;
  source: BrowserHookSource;
  initialUrl?: string;
}

export interface BrowserContextHookContext {
  run?: RunHookContext;
  context: unknown;
  source: BrowserHookSource;
  initialUrl?: string;
}

export interface BrowserRequestHookContext {
  run?: RunHookContext;
  page: unknown;
  request: unknown;
  source: BrowserHookSource;
}

export interface BrowserRequestFailedHookContext {
  run?: RunHookContext;
  page: unknown;
  request: unknown;
  source: BrowserHookSource;
  errorText?: string;
}

export interface BrowserResponseHookContext {
  run?: RunHookContext;
  page: unknown;
  response: unknown;
  source: BrowserHookSource;
  redirectedFromUrl?: string;
}

export interface BrowserRedirectHookContext {
  run?: RunHookContext;
  page: unknown;
  source: BrowserHookSource;
  fromUrl: string;
  toUrl: string;
  response: unknown;
  status?: number;
}

export interface NavigationHookContext {
  run?: RunHookContext;
  page: unknown;
  source: 'dsl-step' | 'scrape-simple' | 'crawl-page';
  requestedUrl: string;
  finalUrl: string;
  waitUntil?: string;
  step?: { index: number; action: string; [k: string]: unknown };
  httpStatus?: number;
  error?: string;
  outcome?: HookOutcomeOverride;
}

export interface DiscoveredLinkHookContext {
  run?: RunHookContext;
  page: unknown;
  sourceUrl: string;
  rawHref: string;
  link: PageLink;
  drop?: boolean;
}

export interface RunnerHook {
  readonly moduleId: string;
  readonly priority?: number;
  beforeRun?(ctx: RunHookContext): Promise<void>;
  onContextCreated?(ctx: BrowserContextHookContext): Promise<void>;
  onPageCreated?(ctx: PageHookContext): Promise<void>;
  onRequest?(ctx: BrowserRequestHookContext): Promise<void>;
  onRequestFailed?(ctx: BrowserRequestFailedHookContext): Promise<void>;
  onResponse?(ctx: BrowserResponseHookContext): Promise<void>;
  onRedirect?(ctx: BrowserRedirectHookContext): Promise<void>;
  afterNavigation?(ctx: NavigationHookContext): Promise<void>;
  afterStep?(ctx: StepHookContext): Promise<void>;
  onDiscoveredLink?(ctx: DiscoveredLinkHookContext): Promise<void>;
  onStepError?(ctx: StepHookContext, error: string): Promise<void>;
  afterRun?(ctx: RunHookContext): Promise<void>;
  onError?(ctx: RunHookContext, error: Error): Promise<void>;
}
