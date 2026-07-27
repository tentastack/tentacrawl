# Challenger Extension Framework - Specification

Status: Draft 2
Owner: Platform / Core
Audience: Core maintainers and community module authors
Scope: `packages/challenger` (new), `packages/core` (contract + registry), `packages/browser`, `packages/dsl`, `packages/cli`, `apps/worker`, `apps/api`, `apps/web`

## 1. Purpose

Tentacrawl executes DSL-driven and "simple" browser runs through `packages/browser`, orchestrated by the `scraper` and `crawler` worker executors. Site-specific and behavior-specific adaptation (proxy selection, fingerprint changes, captcha handling, login, user-behavior mimicry, session inspection, custom artifact analysis) must be possible for community developers without editing core execution logic.

Today three unrelated and incomplete extension mechanisms coexist:

1. `RunnerHook` registered in `ModuleExtensionRegistry`. It declares a rich lifecycle (`onContextCreated`, `onPageCreated`, `onRequest`, `onResponse`, `onRedirect`, `afterNavigation`, `afterStep`, `onDiscoveredLink`, `onStepError`, `onError`) but the executors only ever dispatch `beforeRun` and `afterRun`. The browser package (`runDsl`, `createHardenedContext`, `executeStep`, `collectArtefacts`, `discoverLinks`) receives no hook reference at all, so every per-page, per-request, per-navigation, per-step, and per-link hook is dead code.
2. `DslExtension` (`extendStepSchema` / `compileStep`) registered in the same registry. It is never consulted by `packages/dsl` (the compiler validates against the fixed `dslDocumentSchema`), and `step-executor.ts` dispatches actions through a hard-coded `ACTION_HANDLERS` record, so an extension cannot add an executable step action even if its schema were merged.
3. `ProxyProviderRegistry` plus the `@ProxyProviderMeta` decorator inside `packages/proxy`. A parallel, proxy-specific plugin surface unrelated to the two above.

The Challenger framework replaces all three with one contract-bound extension surface. A *challenger* is an externally authored unit of logic that can observe and mutate every stage of a run - browser launch and context options, navigation flow, per-step execution, network requests/responses/redirects, session state (cookies/storage/headers), proxy selection, fingerprint, collected artifacts, and discovered links - can register new executable DSL actions, can emit diagnostic signals, and can override run outcomes. It is the *only* supported way to extend runtime scraping/crawling behavior, and the contract is identical whether an extension ships in-tree or as a community package.

This spec is deliberately use-case agnostic. It defines the generic mechanism (registration, lifecycle, context shape, mutation surface, state isolation, web contribution, generation, security). It does not implement proxy rotation, captcha solving, login, fingerprint corpora, or user-behavior recipes; those are downstream challengers built on this contract.

Per the user's directive, backward compatibility is not required: `RunnerHook`, `ModuleExtensionRegistry`, `DslExtension`, and the bespoke `ProxyProviderRegistry`/`@ProxyProviderMeta` surface are removed and replaced. `proxy` is rewritten as the reference challenger.

## 2. Goals and non-goals

### 2.1 Goals

- A single, stable contract (`ChallengerExtension` + `ChallengerRegistrar`) that lets community code adapt every stage of a run without modifying core logic.
- Full mutation surface across browser config, browser behavior, navigation flow, session state, proxy selection, fingerprint, artifact management, and link discovery, plus an observe-only signal channel for analysis-only extensions.
- An action-handler registry so challengers can contribute new executable DSL step actions (the missing half of the existing `DslExtension`), enabling login/captcha/user-behavior steps inside YAML flows.
- Deterministic challenger module structure identical to existing feature modules (`scraper`, `crawler`, `proxy`), so a challenger is just a Tentacrawl module that registers extensions.
- Community modules contribute admin pages, sidebar (sidecar) navigation, and routes through `ModuleInfo` metadata and code generation, with no hand-editing of `apps/web`.
- A built-in administration dashboard that lists every registered extension and lets operators enable/disable each one at runtime (a reversible kill switch), without editing config files or regenerating.
- Strong isolation between extensions: per-extension scratch state, priority ordering, per-handler error policy, targeting filters, and timeouts.
- One consolidation: proxy provider selection becomes a challenger capability, retiring the separate `ProxyProviderRegistry` mechanism.

### 2.2 Non-goals

- Implementing any concrete adaptation (proxy provider logic, captcha vendor integration, login recipes, fingerprint corpora, user-behavior strategies). Those are separate modules.
- Out-of-process / VM sandboxing of untrusted third-party code. v1 trusts installed packages (the same trust model as today's pnpm workspace modules); process isolation is future work (section 14).
- Replacing the base YAML DSL grammar. The base grammar stays use-case agnostic; challengers extend it additively.

## 3. Background: current shape (verified against `src`)

Pieces the framework builds on or replaces. Compiled `dist` directories are out of scope and not authoritative.

- `packages/core/src/extension/`: `RunnerHook` + per-stage context types (`runner-hook.ts`), `DslExtension` (`dsl-extension.ts`), `ModuleExtensionRegistry` (`module-extension.registry.ts`), `CoreExtensionModule` (global Nest module exporting the registry). All re-exported from `core/index.ts`. **Replaced** by the Challenger contract + `ChallengerRegistry`.
- `packages/core/src/module-info.ts`: `ModuleInfo` with optional `navigation: ModuleNavigation` and `routes: ModuleRoute[]`. **Reused and extended.**
- `packages/core/src/schema/`: `network-policy.schema.ts` (discriminated union `none` / `static` / `managed`), `artefact-format.schema.ts` (`ArtefactFormat`, `PageLink`, `ArtefactResult`), `enums.ts` (`RunOutcome` = `OK | ERROR | PRECONDITION_FAILED | BLOCKED`). **Reused.**
- `packages/browser`: `createHardenedContext` (context options: `proxy`, `stealth`, `locale`, `timezone`, `headers`, `launchOptions`), `getOrCreateBrowser`, `runDsl`, `executeStep` (with the hard-coded `ACTION_HANDLERS` map), `collectArtefacts`, `discoverLinks`, `normalizeDiscoveredUrl`, stealth seed/init-script generation. Plain functions, **no NestJS dependency** - this property must be preserved. Hooks are not dispatched here today.
- `packages/dsl`: `dslDocumentSchema` / `dslStepSchema` with a fixed `DSL_ACTIONS` enum; `compileDsl` / `parseAndCompile`. The compiler does not consult any extension. **Extended** to merge challenger step schemas and route custom actions.
- Worker executors `packages/scraper/src/worker/scrape-executor.service.ts` and `packages/crawler/src/worker/crawl-page-executor.service.ts`: build a `RunHookContext`, call `extensions.getHooks()`, dispatch only `beforeRun`/`afterRun`, then call browser functions with no hook threading. **Rewritten** to drive the dispatcher.
- `packages/proxy/src/worker/proxy.hook.ts`: the one real hook implementation; mutates `ctx.proxy` and stores a lease id in `ctx.hookData`. `proxy-provider.registry.ts` + `proxy-provider.decorator.ts` provide a separate provider plugin surface. **Rewritten** as the reference `ChallengerExtension`; the provider registry is folded into the challenger config model.
- `packages/cli/src/generate.ts`: scans `modules.config.ts`, parses each module `metadata: ModuleInfo`, emits `apps/{api,worker}/src/generated/modules.ts` + `entities.ts` and `apps/web/src/generated/navigation.ts` + `routes.ts`. **Extended** to also emit a page-component registry.
- `apps/web`: `app/(admin)/shell-config.tsx` consumes generated `navigationItems` + `moduleRoutes` and filters the sidebar by `implementedModuleRoots`; physical thin route files under `app/(admin)/` (e.g. `scrape/page.tsx`) delegate to module frontend pages exported via the `./frontend` subpath. **Extended** with a generic catch-all route so new module pages need no physical file.

## 4. Architecture overview

Three layers, mirroring the existing in-tree pattern (contract in core, runtime in a module, providers self-registered via DI on init):

1. **Contract + registry** in `packages/core`. Pure types plus a DI singleton `ChallengerRegistry`. No browser and no Nest runtime logic beyond registration. This is the only thing both extensions and the runtime import from core, keeping core dependency-light.
2. **Runtime host** in a new `packages/challenger` module. Owns dispatch into the browser lifecycle, per-run state, the signal bus, the helper API, the action-handler registry bridge into the DSL/step executor, persistence of registrations/signals/config, the admin API, and the admin "Extensions" sidecar page. It bridges the framework-free browser package to the registry via an injected dispatcher port.
3. **Challenger extensions**: in-tree modules (a rewritten `proxy`) or community modules. Each is a standard Tentacrawl module whose `forWorker()` providers implement `ChallengerExtension` and self-register on `OnModuleInit`, exactly as `ProxyRunnerHook` registers today.

```
+-------------------- packages/core --------------------+
| ChallengerContract (types)   ChallengerRegistry (DI)  |
+----------------^------------------------^-------------+
                 | imports                | registerExtension()
                 |                         |
+--- packages/browser ---+      +------ community / in-tree challenger modules ------+
| runner / context /     |      | @tentacrawl/proxy (reference)                      |
| step / links / artifact|      | @tentacrawl/<your-challenger>                      |
| -> ChallengerDispatcher|      |   forWorker(): providers implement ChallengerExt  |
|    (injected port)     |      |   frontend: ModuleInfo.navigation + routes        |
+-----------^------------+      +---------------------------------------------------+
            | concrete impl
+------------------ packages/challenger ----------------+
| ChallengerDispatcherService (implements port)         |
| ChallengerStateManager   ChallengerSignalBus          |
| ChallengerHelperFactory  ChallengerActionRegistry     |
| api: ChallengerController (list/config/health/signals)|
| frontend: Extensions page (sidecar)                   |
| data: registration + signal + config entities         |
+-------------------------------------------------------+
```

### 4.1 Key decoupling decision

`packages/browser` must stay free of NestJS and of the registry (it currently exports only plain functions). The framework introduces a `ChallengerDispatcher` *port* - a plain TypeScript interface defined in `packages/browser` (or a tiny shared types package) - that the browser runtime calls at each lifecycle point. The worker provides the concrete `ChallengerDispatcherService` from `packages/challenger` and threads a `ChallengerRunSession` into the browser invocation. When no session is provided (standalone use, `pnpm sandbox`, unit tests), a `NoopChallengerDispatcher` makes every dispatch a no-op, so the browser package behaves exactly as today. This preserves AGENTS.md section 8 ("browser execution flows through `packages/browser` and the shared extension registry") while keeping the dependency direction clean: `browser -> port type`, `challenger -> browser + core`, never `browser -> challenger`.

### 4.2 Browser pooling and fingerprint isolation

`packages/browser` keeps a process-level **browser pool** (`browser-pool.ts`) keyed by *launch profile* - the hash of the resolved launch args (hardening defaults merged with any extension `launchArgs`), `headless`, `channel`, `executablePath`, and a launch-level proxy. `getOrCreateBrowser(launchOptions)` returns the pooled browser for that profile, launching one only when absent. The pool is bounded (`BROWSER_POOL_MAX`, default 4) and evicts the least-recently-used browser that has **no open contexts**, so active runs are never torn down.

This reconciles two goals:

- **Memory conservation (default).** Most runs share one browser and receive a fresh, isolated `BrowserContext`. Per context the framework already varies proxy, `userAgent`, viewport, locale, timezone, and headers - enough to keep cookies/storage/cache separate and break naive request correlation cheaply.
- **Process-level fingerprint isolation (on demand).** Signals that are fixed for a Chromium process - launch flags, TLS/JA3 stack, GPU/WebGL, HTTP/2 framing - cannot differ between contexts of the same browser. A challenger that wants traffic to look like a genuinely different machine sets distinct `launchArgs` (and may set a launch-level proxy); the pool then hands that run its own browser process. Distinct launch profiles therefore yield distinct, uncorrelatable browser identities, while identical profiles continue to share one process.

`launchArgs` are merged on top of the hardening defaults (never replace them) and are honored per run because the pool keys on them - not only on the first launch after worker start.

## 5. The contract (`packages/core/src/extension/challenger-contract.ts`)

The contract below is the canonical surface. All inbound runtime data parsed from config is validated with Zod (`configSchema`), per AGENTS.md section 4. The contract carries no Playwright import; live objects are passed as `unknown` and cast through typed helpers exported from `@tentacrawl/challenger` (`asPage(ctx)`, `asContext(ctx)`, etc.).

### 5.1 Identity, capabilities, targeting

```ts
export type ChallengerTaskType = 'scrape' | 'crawl-page';
export type ChallengerSource =
  | 'dsl-runner' | 'scrape-simple' | 'crawl-page' | 'dsl-step';

export type ChallengerCapability =
  | 'proxy'             // selects/sets the proxy candidate
  | 'session'           // inspects/mutates cookies, storage, headers
  | 'fingerprint'       // mutates browser fingerprint / context options
  | 'navigation'        // influences navigation flow (retry/abort/delay/continue)
  | 'signal-analysis'   // analyses signals only, no mutation
  | 'artifact-analysis' // inspects/augments collected artifacts and links
  | 'user-behavior'     // injects human-like interaction
  | 'dsl-action'        // contributes new executable DSL step actions
  | 'request-intercept' // rewrites/blocks/fulfills requests (docs/request-interception-spec.md)
  | 'response-intercept';// rewrites the origin response body/headers (docs/request-interception-spec.md)

export interface ChallengerTarget {
  hostnames?: string[];      // exact host match (lowercased)
  origins?: string[];        // exact origin match
  urlPatterns?: string[];    // glob/regex source applied to the final URL
  taskTypes?: ChallengerTaskType[];
  metadata?: Record<string, string>;
}
```

`capabilities` is declarative: it drives the admin UI and capability gating (section 9.4) but does not itself grant or deny access. `targets` constrain when an extension's handlers run; an absent/empty target means "all runs".

### 5.2 Runtime context

A single base context is passed to every handler, narrowed per stage. `raw` carries live Playwright objects typed as `unknown`. `extensionState` is the per-extension isolated scratch map (section 9.2). `config` is the validated per-extension configuration (section 7.4). `helpers` is the mutation/emit API (section 5.4).

```ts
export interface ChallengerProxyCandidate {
  server: string; username?: string; password?: string; id?: string;
}
export interface ChallengerRawState {
  browser?: unknown; context?: unknown; page?: unknown;
  request?: unknown; response?: unknown;
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
  networkPolicy: NetworkPolicy;           // from @tentacrawl/core schema
  proxy?: ChallengerProxyCandidate;       // current selection; mutate via helpers
  raw: ChallengerRawState;
  state: Map<string, unknown>;            // THIS extension's isolated scratch
  config: unknown;                        // validated against extension.configSchema
  helpers: ChallengerHelperApi;
}
```

Narrowed per-stage contexts (each extends `ChallengerRuntimeContext`):

- `ChallengerBootstrapContext` - context options resolvable before `createHardenedContext`; carries the draft `ContextOptionsPatch`.
- `ChallengerPageContext` - page created (`raw.page` set).
- `ChallengerRequestContext` / `ChallengerResponseContext` (`+ redirectedFromUrl`) / `ChallengerRedirectContext` (`fromUrl` / `toUrl` / `status`).
- `ChallengerNavigationContext` - `requestedUrl` / `finalUrl` / `waitUntil` / `step?` / `httpStatus?`; mutable `outcomeOverride?`.
- `ChallengerStepContext` - `step` (`index` / `action` / fields) / `stepResult?`.
- `ChallengerSessionContext` - `session: ChallengerSessionSnapshot` (cookies, localStorage, sessionStorage, request headers).
- `ChallengerSignalContext` - `signal: ChallengerSignal`.
- `ChallengerArtifactContext` - `artifactKey` / `artifactValue`; for discovered links, `link: PageLink` and a settable `drop?: boolean` (supersedes `onDiscoveredLink`).
- `ChallengerRunOutcomeContext` - `outcome: RunOutcome` / `reason?` / `error?`.

### 5.3 Signals

Signals are the observe-and-analyse channel. Any handler may emit; `onSignal` handlers and the persistence layer consume. Built-in types stay open (`(string & {})`) so extensions can define their own.

```ts
export const BUILT_IN_CHALLENGER_SIGNAL_TYPES = [
  'network.blocked', 'network.redirect-loop', 'network.challenge-header',
  'session.cookies-changed', 'session.storage-changed',
  'page.captcha-suspected', 'page.interstitial-detected', 'page.login-required',
  'page.unusual-fingerprint-feedback', 'run.outcome-overridden',
] as const;
export type ChallengerSignalType =
  (typeof BUILT_IN_CHALLENGER_SIGNAL_TYPES)[number] | (string & {});

export interface ChallengerSignal {
  signalType: ChallengerSignalType;
  severity: 'info' | 'warn' | 'error';
  timestamp?: string;
  source?: ChallengerSource;
  evidence?: unknown;                 // redacted before persistence (section 14)
  requestId?: string; responseId?: string;
  annotations?: Record<string, unknown>;
}
```

### 5.4 Helper API (mutation surface)

Cross-cutting effects always go through the helper API so the host can order, validate, audit, and persist them deterministically. Self-contained direct Playwright calls on `raw.page` are allowed (typing into a field, injecting an init script for user-behavior/login). Anything that changes shared run state (proxy, outcome, navigation decision, context options, session, artifacts, signals) goes through helpers.

```ts
export interface ChallengerHelperApi {
  emitSignal(signal: ChallengerSignal): void | Promise<void>;
  appendArtifact(key: string, value: unknown): void | Promise<void>;
  dropDiscoveredLink(reason?: string): void | Promise<void>;   // artifact/link stage only
  setProxyCandidate(c: ChallengerProxyCandidate): void | Promise<void>;
  patchContextOptions(p: Partial<ContextOptionsPatch>): void | Promise<void>; // pre-context only
  setSessionState(p: SessionStatePatch): void | Promise<void>;
  requestNavigationOverride(o: ChallengerNavigationOverride): void | Promise<void>;
  setOutcomeOverride(o: ChallengerOutcomeOverride): void | Promise<void>;
}

export interface ContextOptionsPatch {
  proxy?: ChallengerProxyCandidate;
  stealth?: Record<string, unknown>;     // fingerprint overrides (userAgent, viewport, seed inputs)
  locale?: string; timezone?: string;
  headers?: Record<string, string>;
  launchArgs?: string[];                  // Chromium flags; merged over the hardening defaults and used to key the browser pool (section 4.2)
  initScripts?: Array<{ name: string; source: string }>;  // extra addInitScript payloads (per context)
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
  reason?: string; delayMs?: number;
}
export interface ChallengerOutcomeOverride { status: RunOutcome; reason: string; }
```

`patchContextOptions` is only honored when emitted from `onBootstrapContext` / `beforeRun` (before the context is built). `ContextOptionsPatch` is a superset of the browser `ContextOptions`, adding `launchArgs` and `initScripts` so fingerprint and stealth challengers can inject behavior without the browser package knowing about them. Context-level fields (`proxy`, `stealth`, `locale`, `timezone`, `headers`, `initScripts`) apply to the per-run context; `launchArgs` select the pooled browser process (section 4.2), so a challenger that needs a distinct process-level fingerprint sets `launchArgs` and gets its own browser.

### 5.5 Registrar, extension, and DSL actions

Extensions attach granular handlers through a `ChallengerRegistrar` in `register()`, and/or implement coarse `beforeRun` / `afterRun` / `onError` for whole-run setup/teardown. Granular handlers are preferred.

```ts
export type ChallengerHandlerMode = 'mutating' | 'observer';
export type ChallengerErrorPolicy =
  | 'fail-run' | 'warn-and-continue' | 'disable-extension-for-run';

export interface ChallengerHandlerOptions {
  mode?: ChallengerHandlerMode;     // observer handlers run concurrently, cannot mutate
  priority?: number;                // lower runs earlier; default 100
  timeoutMs?: number;               // per-invocation timeout
  errorPolicy?: ChallengerErrorPolicy;  // default 'warn-and-continue'
  targets?: ChallengerTarget[];     // narrower than extension-level targets
}
export type ChallengerHandler<T> = (ctx: T) => void | Promise<void>;

export interface ChallengerRegistrar {
  onBootstrapContext(h: ChallengerHandler<ChallengerBootstrapContext>, o?: ChallengerHandlerOptions): void;
  onCreatePage(h: ChallengerHandler<ChallengerPageContext>, o?: ChallengerHandlerOptions): void;
  beforeNavigation(h: ChallengerHandler<ChallengerNavigationContext>, o?: ChallengerHandlerOptions): void;
  afterNavigation(h: ChallengerHandler<ChallengerNavigationContext>, o?: ChallengerHandlerOptions): void;
  beforeStep(h: ChallengerHandler<ChallengerStepContext>, o?: ChallengerHandlerOptions): void;
  afterStep(h: ChallengerHandler<ChallengerStepContext>, o?: ChallengerHandlerOptions): void;
  onRequest(h: ChallengerHandler<ChallengerRequestContext>, o?: ChallengerHandlerOptions): void;
  onResponse(h: ChallengerHandler<ChallengerResponseContext>, o?: ChallengerHandlerOptions): void;
  onRedirect(h: ChallengerHandler<ChallengerRedirectContext>, o?: ChallengerHandlerOptions): void;
  onSessionSnapshot(h: ChallengerHandler<ChallengerSessionContext>, o?: ChallengerHandlerOptions): void;
  onSignal(h: ChallengerHandler<ChallengerSignalContext>, o?: ChallengerHandlerOptions): void;
  onArtefactCollected(h: ChallengerHandler<ChallengerArtifactContext>, o?: ChallengerHandlerOptions): void;
  onDiscoveredLink(h: ChallengerHandler<ChallengerArtifactContext>, o?: ChallengerHandlerOptions): void;
  onRunOutcome(h: ChallengerHandler<ChallengerRunOutcomeContext>, o?: ChallengerHandlerOptions): void;
  registerAction(action: ChallengerActionDefinition): void;   // new executable DSL step
}

export interface ChallengerExtension {
  readonly moduleId: string;       // owning module, e.g. 'proxy'
  readonly extensionId: string;    // unique within module, e.g. 'proxy-pool'
  readonly version: string;
  readonly priority?: number;      // extension-level default
  readonly capabilities: ChallengerCapability[];
  readonly targets?: ChallengerTarget[];
  readonly configSchema?: ZodSchema;
  register?(registrar: ChallengerRegistrar): void;
  beforeRun?(ctx: ChallengerRuntimeContext): Promise<void>;
  afterRun?(ctx: ChallengerRuntimeContext): Promise<void>;
  onError?(ctx: ChallengerRuntimeContext, error: Error): Promise<void>;
}
```

The fully-qualified identity is `${moduleId}/${extensionId}` and must be globally unique; the registry rejects duplicates.

#### 5.5.1 Action definitions (replacing `DslExtension`)

`DslExtension` is removed. A challenger contributes an executable step action through `registerAction`, which couples the schema, the compile step, and the runtime executor in one place. This closes the gap where `step-executor.ts` cannot run an action the DSL schema would allow.

```ts
export interface ChallengerActionDefinition {
  action: string;                          // unique action name, e.g. 'solveCaptcha'
  schema: ZodSchema;                        // validates the YAML step fields
  compile?(step: unknown): unknown;         // optional compile-time transform
  execute(ctx: ChallengerStepContext): Promise<ChallengerActionResult>;
}
export interface ChallengerActionResult {
  output?: unknown;                         // stored as an artifact under the step outputKey
  httpStatus?: number;
  error?: string;
  preconditionFailed?: boolean;
}
```

Action names must not collide with the base `DSL_ACTIONS` enum or with another extension's action; the registry rejects collisions. The DSL compiler (section 10) merges all action schemas into the step union, and `step-executor.ts` looks up unknown actions in the `ChallengerActionRegistry` before failing.

## 6. Registry (`packages/core/src/extension/challenger.registry.ts`)

A DI singleton, provided and exported by `CoreExtensionModule` (`@Global`). It fully replaces `ModuleExtensionRegistry`.

```ts
@Injectable()
export class ChallengerRegistry {
  registerExtension(ext: ChallengerExtension): void;   // dedupe by moduleId/extensionId; throws on dup
  getExtensions(): ChallengerExtension[];               // sorted by priority asc, stable
  registerAction(def: ChallengerActionDefinition): void; // dedupe by action name; throws on collision
  getActions(): ChallengerActionDefinition[];
  getAction(name: string): ChallengerActionDefinition | undefined;
}
```

Registration timing matches the proxy pattern: an extension provider implements `OnModuleInit` and calls `registry.registerExtension(this)`. The host invokes `register(registrar)` once per extension immediately after registration to collect handlers and actions into the dispatch table and the action registry.

## 7. Runtime host (`packages/challenger`)

A new feature-shaped module following the deterministic layout in AGENTS.md section 9, enabled in `modules.config.ts` as `{ id: 'challenger', package: '@tentacrawl/challenger' }`.

### 7.1 Package layout

```
packages/challenger/src/
  index.ts                          # exports metadata: ModuleInfo, ChallengerModule, public types/helpers (asPage, asContext, ...)
  challenger.module.ts              # forApi() / forWorker()
  event.ts
  api/
    challenger.controller.ts        # GET extensions, GET/PUT config, GET health, GET run signals
    challenger.service.ts
    challenger.api-module.ts
  worker/
    challenger-dispatcher.service.ts # implements ChallengerDispatcher port; the orchestrator
    challenger-state.manager.ts      # per-run + per-extension isolated state
    challenger-signal.bus.ts         # in-run signal fan-out + persistence enqueue
    challenger-helper.factory.ts     # builds ChallengerHelperApi bound to (run, extensionId)
    challenger-action.registry.ts    # bridge: exposes registered actions to dsl/step executor
    challenger.worker-module.ts
  data/
    entities.ts                     # ChallengerRegistrationEntity, ChallengerSignalEntity, ChallengerConfigEntity
    schemas.ts                      # Zod DTOs for API + persisted shapes
  frontend/
    index.ts
    pages/extensions/page.tsx       # list installed challengers (sidecar)
    pages/extensions/[id]/page.tsx  # detail: capabilities, config form, health, recent signals
    components/
    hooks/use-challengers.ts
  port/
    challenger-dispatcher.ts        # ChallengerDispatcher interface + NoopChallengerDispatcher
  __tests__/
```

### 7.2 Dispatcher port and lifecycle invocation

The port is the single seam the browser package calls. It is framework-free so `packages/browser` imports only the type.

```ts
export interface ChallengerDispatcher {
  beginRun(seed: ChallengerRunSeed): Promise<ChallengerRunSession>;
}
export interface ChallengerRunSession {
  ctx: ChallengerRuntimeContext;                  // shared; mutated through helpers
  dispatch(stage: ChallengerStage, patch: StagePatch): Promise<ChallengerStageResult>;
  resolveAction(name: string): ChallengerActionDefinition | undefined;
  end(outcome: RunOutcome, error?: Error): Promise<void>;
}
export type ChallengerStage =
  | 'bootstrap-context' | 'create-page'
  | 'before-navigation' | 'after-navigation'
  | 'before-step' | 'after-step'
  | 'request' | 'response' | 'redirect'
  | 'session-snapshot' | 'artefact-collected' | 'discovered-link'
  | 'run-outcome';
```

`dispatch` runs all matching handlers for a stage in priority order (mutating handlers serially, observer handlers concurrently afterward), applies queued helper effects, and returns the resolved decision (effective `ContextOptions` patch, navigation override, outcome override, link drop). The host enforces `timeoutMs` and `errorPolicy` per handler and writes a per-handler audit entry.

Invocation points to add into `packages/browser`:

- **Context build** (`context-factory.ts` / runner pre-context): `bootstrap-context` + coarse `beforeRun` resolve a merged `ContextOptionsPatch` (proxy, fingerprint/stealth, locale, timezone, headers, launchArgs, initScripts) before `createHardenedContext` builds the context.
- **Page created** (`runner.ts` and executors, after `context.newPage()`): `create-page`; also attach Playwright `page.on('request'|'response'|...)` listeners that forward to `request` / `response` / `redirect` stages.
- **Navigation** (`runner.ts` goto/click, executors' `page.goto`, `step-executor.ts` `handleGoto`): `before-navigation` / `after-navigation`; honor `ChallengerNavigationOverride` (`retry` / `abort` / `delay` / `continue`).
- **Step** (`step-executor.ts` per action, `runDsl` loop): `before-step` / `after-step` with `ChallengerStepContext`. Unknown actions resolve through `resolveAction` and run the extension's `execute`.
- **Session snapshot** (`session-snapshot`): materialized on demand (after navigation, before/after run) by reading cookies/storage/headers into `ChallengerSessionSnapshot`.
- **Artifact collection** (`format-pipeline.ts` `collectArtefacts`): `artefact-collected` per artifact key. Link discovery (`link-discovery.ts` `discoverLinks`): `discovered-link` per link, honoring `dropDiscoveredLink`.
- **Run outcome** (executors' `finally`): `run-outcome` + coarse `afterRun` / `onError`; honor `ChallengerOutcomeOverride`.

The executors stop building `RunHookContext` and looping `getHooks()`; they call `dispatcher.beginRun(seed)` and thread the returned `session` through the browser calls. `runDsl`, `createHardenedContext`, the simple-scrape path, `collectArtefacts`, and `discoverLinks` accept an optional `session?: ChallengerRunSession` and call `session.dispatch(...)`; when absent (Noop) they behave exactly as today.

### 7.3 State, signals, helpers, persistence

- `ChallengerStateManager` owns `Map<extensionId, Map<string, unknown>>`, created fresh per run, never shared across extensions or runs. It replaces the single flat `hookData` map. The host hands each handler only its own `state` map on the context.
- `ChallengerSignalBus` fans signals to `onSignal` handlers synchronously within the run and enqueues them for persistence as `ChallengerSignalEntity` (correlated by `taskId` / `correlationId`). Signals feed the admin detail page and integrate with the existing `ACTIVITY_LOG_RECORDER` and `NOTIFICATION_PUBLISHER` core ports - no new notification plumbing.
- `ChallengerHelperFactory` builds a `ChallengerHelperApi` bound to `(runSession, extensionId)` so every effect is attributable; effect application order is deterministic (handler priority, then extension priority, then registration order).
- Persistence uses MikroORM entities owned by this module (`data/entities.ts`), per AGENTS.md section 9. Job payloads stay small (ids only); signals/diagnostics are written by the worker and read by the API.

### 7.4 Admin API, config, and lifecycle

`ChallengerController` exposes: list installed extensions (`moduleId` / `extensionId` / `version` / `capabilities` / `targets` / `status` / `enabled`); toggle enabled state (`PUT /challengers/:id/enabled`); get/set per-extension config (`GET` / `PUT /challengers/:id/config`); health (last error, last run, signal counts); per-run signal/diagnostic retrieval; and purge of a removed extension (`DELETE /challengers/:id`).

**Configuration is decentralized.** The host does not own a configuration *schema* or a generic editor - that lives with each extension, which knows its own shape and constraints. The host provides only a neutral key/value *storage* primitive: config and the enable flag live in `ChallengerConfigEntity`, and `GET` / `PUT /challengers/:id/config` read and write an opaque JSON object. Each extension renders its own settings UI (the proxy module ships a small dialog; another extension may ship a richer form or none) and validates client-side against its own schema before saving. The dispatcher is the single point that validates the stored config against the extension's `configSchema` at run time and injects the result as `ctx.config`. Validation is graceful: on a mismatch (typically an extension upgrade that changed the schema) the dispatcher falls back to the schema defaults and emits a persisted `challenger.config-invalid` signal; it only skips the extension when even an empty config fails validation. This subsumes the old proxy provider config model: a proxy challenger declares its provider config via `configSchema` instead of the retired `ProxyProviderRegistry`.

**Lifecycle is archive-then-purge.** `ChallengerRegistrationEntity` carries a `status` of `active` (loaded by a worker) or `archived` (previously registered, no longer loaded). On boot the worker's registration sync (a) refuses to run when its own registry is empty - so a half-booted or mis-configured worker never archives another worker's registrations - (b) upserts every loaded extension as `active`, and (c) marks rows it no longer loads as `archived` **without deleting them**, preserving config and signal history. An archived extension never executes, because the dispatcher only iterates the in-memory registry. Re-adding the module restores it to `active` and reuses the retained config. `DELETE /challengers/:id` purges an `archived` extension's registration, config, and signals together; purging an `active` extension is rejected (remove it from `modules.config.ts` and regenerate first).

### 7.5 Admin dashboard UI

The `challenger` module ships a simple administration dashboard so operators can see and control what is installed without touching config files. It lives in `frontend/pages/extensions/` and surfaces as the "Extensions" sidecar entry (section 8).

- **List view** (`pages/extensions/page.tsx`): a `DataTable` of every registered extension showing `moduleId/extensionId`, `version`, declared `capabilities`, `targets` summary, signal count, a `status` badge (`active` / `archived`), and an **enabled/disabled toggle** per row. Toggling calls `PUT /challengers/:id/enabled`; the change takes effect on the next run (the dispatcher reads `ChallengerConfigEntity` per run, so no restart or regeneration is needed). Disabled extensions remain listed, and their handlers and DSL actions are skipped at dispatch time. `archived` extensions show the toggle disabled (they cannot run regardless). The list is read from `GET /challengers` via `use-challengers.ts` (TanStack Query) and wrapped in `DataLoader`; `flash()` confirms success/failure.
- **Detail view** (`pages/extensions/[id]/page.tsx`): the enable/disable control, the capability list, last error, and a recent-signals panel for that extension. For an `archived` extension it shows the status and a **Purge** action (confirm dialog) that calls `DELETE /challengers/:id`. The detail view deliberately has **no generic config editor**: configuration UI is owned by each extension (section 7.4), so a config-bearing extension surfaces its own settings page/dialog instead.

Enable/disable is purely an operational gate stored in `ChallengerConfigEntity`; it does not unregister the extension (archiving happens automatically when the module is removed from `modules.config.ts` and the worker reboots; purge then forgets it permanently). This gives operators a fast, reversible kill switch for a misbehaving community extension and a clean, retention-friendly removal path.

## 8. Web app contribution (sidecar pages and navigation)

Community modules contribute UI through the existing `ModuleInfo.navigation` and `ModuleInfo.routes`, already turned by the generator into `apps/web/src/generated/navigation.ts` and `routes.ts`. Two gaps must close so a new module's pages appear without hand-editing `apps/web`:

1. **Page component registry.** Extend `packages/cli/src/generate.ts` to emit `apps/web/src/generated/page-registry.ts`: a map from each `ModuleRoute.path` to a lazy import of the module's exported frontend page component. Modules already expose pages via the `./frontend` subpath export (e.g. `@tentacrawl/scraper/frontend` exports `ScrapeListPage`). `ModuleRoute.page` is the component export name to resolve. The generator emits, per route, `() => import('<package>/frontend').then(m => m.<ComponentForPage>)` keyed by path.
2. **Catch-all admin route.** Add one physical generic Next.js route `apps/web/src/app/(admin)/[[...segments]]/page.tsx` that resolves the current path against `moduleRoutes` + `page-registry`, renders the mapped component inside `DataLoader`, and 404s otherwise. Existing hand-written thin routes continue to work and take precedence; new community pages need no physical file. `shell-config.tsx`'s `implementedModuleRoots` filter is updated to treat any module with routes as implemented, so a module declaring `navigation` shows up in the sidecar automatically.

The `challenger` host module itself ships an "Extensions" sidecar entry (`navigation: { label: 'Extensions', icon: 'Puzzle', path: '/extensions', order: 90 }`) and routes for the list/detail pages. This is the simple administration dashboard described in section 7.5: it lists every registered extension and lets an operator enable/disable each one. It doubles as the reference for community UI contribution.

This upholds "the framework is the only way to extend": runtime behavior flows only through the Challenger contract, and UI flows only through `ModuleInfo` + generated registries.

## 9. Determinism, isolation, ordering

### 9.1 Ordering

Extensions sort by `priority` ascending (stable). Within a stage, mutating handlers execute serially ordered by (handler priority, extension priority, registration order); observer handlers execute concurrently after mutating handlers and cannot affect run state. Effect resolution is last-writer-wins for scalar overrides (proxy, outcome) with the winning extension recorded in the audit entry; patches (headers, context options, session) merge in order with conflicts logged.

### 9.2 State isolation

Each handler receives only its own extension's `state` map. Cross-extension communication is allowed only via signals (`emitSignal` -> `onSignal`), never by reaching into another extension's state or by `raw` mutations that bypass helpers.

### 9.3 Error policy and timeouts

Per-handler `errorPolicy`: `warn-and-continue` (default - log, emit an `error` signal, continue), `fail-run` (abort the run with `ERROR` or `PRECONDITION_FAILED`), `disable-extension-for-run` (drop the extension's remaining handlers for this run). `timeoutMs` wraps each invocation; a timeout is handled per `errorPolicy`. This bounds the blast radius of a hanging or crashing community extension.

### 9.4 Capability gating

The host reads an allowlist of capabilities from config/env. Handlers whose extension declares a non-allowed capability are skipped with a warning. Default: all capabilities allowed for in-tree modules; community packages are gated (section 14).

## 10. DSL and step execution

The base YAML grammar in `packages/dsl` stays use-case agnostic. Challenger actions extend it additively:

- `parseDsl` / `compileDsl` accept an injected list of `ChallengerActionDefinition` (sourced from `ChallengerRegistry.getActions()`). The step schema becomes `dslStepSchema.or(...extensionSchemas)`; unknown base actions validate against a matching extension action schema. `compileDsl` runs the action's optional `compile`.
- `step-executor.ts` keeps its built-in `ACTION_HANDLERS` for the base actions, but when an action is not built in it resolves it via `session.resolveAction(name)` and runs `execute(stepCtx)`, mapping `ChallengerActionResult` to the existing `StepResult`. This is the missing executor half that makes login/captcha/user-behavior steps runnable from YAML.

Most challengers operate purely through runtime stages; DSL actions are optional and gated by the `dsl-action` capability.

## 11. Authoring a community challenger (reference flow)

1. Scaffold a pnpm workspace package `@tentacrawl/<name>` with the deterministic layout; `src/index.ts` exports `metadata: ModuleInfo` and the Nest module with `forApi()` / `forWorker()`.
2. In `forWorker()`, provide a service implementing `ChallengerExtension` that self-registers on `OnModuleInit` (mirror `proxy.hook.ts`). Declare `capabilities`, optional `targets`, and `configSchema`.
3. Implement `register(registrar)` to attach stage handlers (using `helpers` for mutations and `emitSignal` for analysis) and any `registerAction` definitions. Use `ctx.state` for per-run scratch (a captured session, a lease id, a retry counter).
4. Optionally add `frontend/` pages plus `navigation` / `routes` in `metadata` to appear in the sidecar.
5. Add `{ id, package }` to `modules.config.ts` and run `pnpm generate`. The generator wires worker/api modules, entities, navigation, routes, and the page registry.

Illustrative shapes (not use-case implementations):

```ts
register(r: ChallengerRegistrar) {
  // proxy selection (migrated reference): set a candidate before the context is built
  r.onBootstrapContext(async (ctx) => {
    const candidate = await this.pickProxy(ctx);          // module-internal logic
    if (candidate) await ctx.helpers.setProxyCandidate(candidate);
  }, { mode: 'mutating', priority: 10 });

  // analysis-only: inspect response headers, emit a signal, never mutate
  r.onResponse(async (ctx) => {
    if (looksLikeChallenge(ctx)) {
      await ctx.helpers.emitSignal({ signalType: 'network.challenge-header', severity: 'warn' });
    }
  }, { mode: 'observer' });

  // navigation control: ask the runner to retry/abort/delay
  r.afterNavigation(async (ctx) => {
    if (ctx.httpStatus === 429) {
      await ctx.helpers.requestNavigationOverride({ action: 'delay', delayMs: 5000 });
    }
  }, { mode: 'mutating', priority: 50 });

  // new executable DSL action usable from YAML as `action: solveCaptcha`
  r.registerAction({
    action: 'solveCaptcha',
    schema: z.object({ action: z.literal('solveCaptcha'), selector: z.string() }),
    execute: async (ctx) => ({ output: await this.solve(ctx) }),
  });
}
```

## 12. File-by-file change list

New:

- `packages/core/src/extension/challenger-contract.ts` - all contract types from section 5.
- `packages/core/src/extension/challenger.registry.ts` - `ChallengerRegistry` (section 6).
- `packages/challenger/**` - the host module (section 7.1).
- `packages/browser/src/port/challenger-dispatcher.ts` - `ChallengerDispatcher` / `ChallengerRunSession` / `ChallengerStage` types + `NoopChallengerDispatcher` (or a shared types-only package re-exported by both browser and challenger).
- `packages/browser/src/browser-pool.ts` - launch-profile-keyed browser pool with bounded LRU eviction (section 4.2); owns `getOrCreateBrowser` / `closeBrowser`.
- `apps/web/src/app/(admin)/[[...segments]]/page.tsx` - generic catch-all route.
- `apps/web/src/generated/page-registry.ts` - generated lazy page map.

Modified:

- `packages/core/src/extension/index.ts` and `packages/core/src/index.ts` - export the contract + registry; remove `RunnerHook`, `DslExtension`, `ModuleExtensionRegistry` exports.
- `packages/core/src/extension/core-extension.module.ts` - provide/export `ChallengerRegistry` instead of `ModuleExtensionRegistry`.
- `packages/browser/src/context-factory.ts` - accept `session?`, dispatch `bootstrap-context`, apply `ContextOptionsPatch` (incl. `launchArgs`, `initScripts`).
- `packages/browser/src/runner.ts` - accept `session?`, dispatch `create-page`, `before/after-navigation`, `before/after-step`, `run-outcome`; attach request/response/redirect listeners.
- `packages/browser/src/step-executor.ts` - resolve non-built-in actions via `session.resolveAction`; dispatch `before/after-step`.
- `packages/browser/src/format-pipeline.ts` - dispatch `artefact-collected`.
- `packages/browser/src/link-discovery.ts` - dispatch `discovered-link`, honor link drop.
- `packages/browser/src/index.ts` - export the port types.
- `packages/dsl/src/compiler.ts` and `dsl.schema.ts` - accept injected action definitions; merge schemas; route compile.
- `packages/scraper/src/worker/scrape-executor.service.ts` and `packages/crawler/src/worker/crawl-page-executor.service.ts` - drive `dispatcher.beginRun()` and thread `session`; drop `RunHookContext` / `getHooks()`.
- `packages/proxy/**` - rewrite `proxy.hook.ts` as a `ChallengerExtension`; remove `proxy-provider.registry.ts` + `proxy-provider.decorator.ts`; move provider config under `configSchema`.
- `packages/cli/src/generate.ts` - emit `page-registry.ts`; update navigation/route generation as needed.
- `apps/web/src/app/(admin)/shell-config.tsx` - treat any module with routes as implemented.
- `modules.config.ts` - add `{ id: 'challenger', package: '@tentacrawl/challenger' }`.

Removed:

- `packages/core/src/extension/runner-hook.ts`, `dsl-extension.ts`, `module-extension.registry.ts` and their tests.

After contract/metadata changes, run `pnpm generate` and commit the regenerated registries (do not hand-edit them), per AGENTS.md section 2.

## 13. Testing

Per AGENTS.md section 11, deterministic unit + integration coverage:

- Contract/registry: extension dedupe, action-name collision rejection, priority sort stability (mirror the retired `module-extension.registry.spec.ts`).
- Dispatcher: stage ordering (mutating serial vs observer concurrent), effect resolution (last-writer-wins, patch merge), timeout and each `errorPolicy`, target filtering, state isolation between extensions.
- Browser integration: each stage fires with the correct narrowed context; the Noop path is a true no-op; `ContextOptionsPatch`, navigation override, link drop, and outcome override take effect; session-snapshot shape.
- DSL/action: extension action schema merges into the step union; `step-executor` runs a registered action; base actions unaffected.
- Generation: `page-registry.ts` plus updated `navigation.ts` / `routes.ts` for a fixture challenger module; catch-all route resolves and 404s correctly.
- Reference: rewritten `proxy` challenger reproduces current lease acquire/release behavior under the new contract.

## 14. Security and trust

- v1 trusts installed workspace/published packages (the current model). Secrets are never logged (AGENTS.md section 13); the host redacts proxy credentials, cookies, and storage values in signal/audit persistence.
- Secret-bearing config or entity fields owned by an extension must be masked by that module's own API: never return a stored secret in a list or detail response. Expose a boolean presence flag (e.g. `hasPassword`) and accept writes under a leave-blank-to-keep convention so the value round-trips without ever leaving the server. The proxy module is the reference (section 5.3 of the proxy spec).
- Capability gating (9.4) plus per-handler timeouts/error policy bound a misbehaving extension.
- Site terms, rate limits, and `NetworkPolicy` remain authoritative; extensions may read `networkPolicy` but cannot bypass the configured network mode.
- Future work (out of scope): out-of-process / worker-thread sandboxing of community handlers, signed extension manifests, and a capability-scoped permission prompt in the admin UI.

## 15. Open questions

- Navigation `retry` semantics for multi-step DSL runs: retry the single step vs re-run from a checkpoint. Proposed: step-level retry with a host-enforced max-retry guard surfaced as a signal.
- Artifact key collisions across extensions: namespace `appendArtifact` under `challenger.<extensionId>.<key>` vs trust authors. Proposed: auto-namespace.
- Whether the dispatcher port type lives in `packages/browser` directly or in a tiny `@tentacrawl/contract` package imported by both `browser` and `challenger`. Leaning on a shared types-only package to avoid any conceptual coupling of browser to the host.

### Resolved since Draft 2

- **Browser lifecycle**: a launch-profile-keyed browser pool (section 4.2) replaces the single shared browser; `launchArgs` now select a process and are honored per run.
- **Configuration**: decentralized to each extension; the host provides storage + run-time validation only, with graceful default fallback (section 7.4). No generic config editor.
- **Removal**: archive-then-purge lifecycle with a `status` field (`active` / `archived`) and an empty-registry guard (section 7.4).
- **Per-request interception/mutation**: the observe-only `onRequest` / `onResponse` stages do not let an extension rewrite, block, or fulfill requests. A dedicated `request-intercept` capability adds that; it is specified in `docs/request-interception-spec.md` and implemented (`interceptRequest` registrar entry, `route-request` stage, `context.route` integration).
