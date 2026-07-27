# Request Interception and Mutation - Specification

Status: Implemented (v1)
Owner: Platform / Core
Audience: Core maintainers and community challenger authors
Scope: `packages/core` (contract), `packages/browser` (port + integration), `packages/challenger` (dispatch + arbitration), downstream challengers
Depends on: `docs/challenger-framework-spec.md`

## 1. Purpose

The Challenger framework already lets an extension *observe* network traffic through the `onRequest` / `onResponse` / `onRedirect` stages, but those stages are observe-only: a handler can read a request and emit a signal, yet it cannot change, block, or answer it. For Tentacrawl's stated ambition - giving community extensions the tools to fetch content from hostile or heavily-defended origins and make traffic look natural - that is the missing primitive.

Per-request control unlocks the use cases the observe-only surface cannot:

- Rewrite outbound requests per request: spoof or normalize headers (`User-Agent`, `Referer`, `Sec-*`, `Accept-Language`), strip automation tells, sign requests, inject auth tokens.
- Block requests by URL or resource type: drop analytics, ads, fingerprinting beacons, and heavy media to cut bandwidth and shrink the correlatable surface.
- Fulfill requests locally: serve a cached/replayed response, stub an endpoint, or short-circuit a known challenge without a network round trip.
- Throttle or reorder: add jitter to specific request classes to mimic human pacing.

This builds on Playwright's `BrowserContext.route()` / `Route` API. It is a *new capability* on the existing contract, not a replacement for the observe-only stages, which remain for telemetry.

## 2. Goals and non-goals

### 2.1 Goals

- One additional Challenger capability, `request-intercept`, with a single registrar entry point and a small, typed decision API: continue (optionally modified), abort, or fulfill.
- Deterministic arbitration when several extensions want to act on the same request.
- Opt-in routing scoped by URL pattern and resource type so the (real) interception cost is paid only where asked.
- The framework-free property of `packages/browser` is preserved: interception flows through the existing dispatcher port, never a direct dependency on the host.
- Observe-only `onRequest` / `onResponse` keep working unchanged and coexist with interception.

### 2.2 Non-goals

- Bypassing the configured `NetworkPolicy`. Interception rewrites a request; egress still flows through the policy's proxy/direct mode (section 7).
- Response *body* rewriting on the wire for streamed responses. v1 covers request mutation and whole-response fulfillment; a follow-up `response-intercept` capability (`interceptResponse`) adds buffered response transformation via `route.fetch()` + `route.fulfill()` (implemented; see section 12). Incremental transformation of streamed responses is still future work.
- WebSocket frame mutation. v1 targets HTTP(S) requests; `web_socket` routing is a future extension.

## 3. Capability

Add `'request-intercept'` to `ChallengerCapability` and `CHALLENGER_CAPABILITIES`. It is declarative and gated exactly like other capabilities (framework spec section 9.4 / 14): allowed for in-tree modules by default, gated for community packages via the capability allowlist. An extension that registers an interception handler must declare the capability or the handler is skipped with a warning.

## 4. Contract additions (`packages/core/src/extension/challenger-contract.ts`)

### 4.1 Route context

```ts
export interface ChallengerRequestInfo {
  url: string;
  method: string;
  resourceType: string;                 // 'document' | 'xhr' | 'fetch' | 'image' | 'script' | 'stylesheet' | 'media' | ...
  headers: Record<string, string>;
  postData?: string;
  isNavigationRequest: boolean;
}

export interface ChallengerRouteContext extends ChallengerRuntimeContext {
  request: ChallengerRequestInfo;        // read-only snapshot of the intercepted request
}
```

### 4.2 Decision API

A route handler resolves the request through helpers on the route context. Exactly one terminal decision is applied per request; non-terminal `modifyRequest` calls accumulate.

```ts
export interface ChallengerRequestOverride {
  url?: string;                          // redirect the request (same-origin or policy-permitted)
  method?: string;
  headers?: Record<string, string>;      // merged over existing headers
  postData?: string;
}

export interface ChallengerFulfillResponse {
  status?: number;                       // default 200
  headers?: Record<string, string>;
  contentType?: string;
  body?: string;                         // utf-8; base64 bodies via headers + body convention
}

export interface ChallengerRouteHelpers {
  modifyRequest(patch: ChallengerRequestOverride): void;   // non-terminal; may be called by several handlers
  abortRequest(errorCode?: string): void;                  // terminal; e.g. 'blockedbyclient', 'failed'
  fulfillRequest(response: ChallengerFulfillResponse): void; // terminal
  // absence of a terminal call => continue with the accumulated request override
}
```

`ChallengerRouteContext` exposes these as `ctx.route` (kept separate from the cross-cutting `ctx.helpers` so the request-scoped surface is obvious):

```ts
export interface ChallengerRouteContext extends ChallengerRuntimeContext {
  request: ChallengerRequestInfo;
  route: ChallengerRouteHelpers;
}
```

### 4.3 Registrar

```ts
export interface ChallengerRouteHandlerOptions extends ChallengerHandlerOptions {
  routePatterns?: string[];      // glob/regex; only matching URLs are routed (perf gate). default: all
  resourceTypes?: string[];      // restrict to these Playwright resource types
}

export interface ChallengerRegistrar {
  // ...existing methods...
  interceptRequest(
    h: ChallengerHandler<ChallengerRouteContext>,
    o?: ChallengerRouteHandlerOptions,
  ): void;
}
```

`interceptRequest` handlers are implicitly `mutating` (an `observer` mode is rejected at registration - observation already has `onRequest`). `timeoutMs` and `errorPolicy` apply as for any handler; a timed-out or erroring handler is treated per `errorPolicy` and the request falls through to `continue` (fail-open) so a broken extension never wedges the page.

## 5. Port and dispatch (`packages/browser` + `packages/challenger`)

### 5.1 Stage

Add a `route-request` stage to `ChallengerStage`. Unlike other stages, its result is a `RouteDecision` rather than the generic `ChallengerStageResult`:

```ts
export type RouteDecision =
  | { action: 'continue'; override?: ChallengerRequestOverride }
  | { action: 'abort'; errorCode?: string }
  | { action: 'fulfill'; response: ChallengerFulfillResponse };

export interface ChallengerRunSession {
  // ...existing...
  routeRequest(request: ChallengerRequestInfo): Promise<RouteDecision>;
  hasRouteHandlers(): boolean;            // patterns considered at registration
}
```

The `Noop` session returns `{ action: 'continue' }` and `hasRouteHandlers() === false`, so a browser run with no host behaves exactly as today.

### 5.2 Arbitration (host)

`ChallengerRunSessionImpl.routeRequest` runs the matching `route-request` handlers in the framework's standard order (handler priority, then extension priority, then registration order; framework spec section 9.1), building a shared `ChallengerRequestOverride` accumulator:

1. Handlers run serially. Each may call `modifyRequest` (merged into the accumulator; last-writer-wins per field, headers merged) and/or a terminal `abortRequest` / `fulfillRequest`.
2. The **first terminal decision wins** and stops the chain; its winning extension is recorded in the audit entry. A `route.decided` signal is emitted (`abort` / `fulfill`) for observability.
3. If no handler is terminal, the accumulated override is applied and the request continues.

Target filtering (framework spec section 5.1) plus `routePatterns` / `resourceTypes` decide which handlers see a given request.

### 5.3 Browser integration (`challenger-integration.ts`)

In `instrumentPage`, when `session.hasRouteHandlers()` is true, register a single `context.route(pattern, handler)` (union of declared patterns, or `'**/*'` when unconstrained). The handler builds a `ChallengerRequestInfo` from the Playwright `Route`/`Request`, calls `await session.routeRequest(info)`, and maps the `RouteDecision` onto the Playwright `Route`:

- `continue` -> `route.continue(override?)`
- `abort` -> `route.abort(errorCode)`
- `fulfill` -> `route.fulfill(response)`

Routing is registered at the context level so it covers every page/frame. The observe-only `page.on('request')` listener (framework spec section 7.2) is unaffected and still fires for telemetry.

## 6. Determinism and isolation

- Per request, the handler chain is serial and ordered; across requests, route handlers run concurrently (Playwright invokes them per request). State isolation is unchanged: each handler sees only its own `ctx.state`.
- `modifyRequest` accumulation and terminal-wins are deterministic given a fixed extension set and priorities.
- Fail-open on error/timeout bounds the blast radius: a misbehaving interceptor degrades to passthrough, it does not hang the page.

## 7. Security and policy

- Interception does not relax the run's `NetworkPolicy`. Rewritten requests still egress through the configured proxy/direct mode; an extension cannot use `fulfillRequest` or `modifyRequest` to reach an origin the policy forbids where such a restriction is enforced.
- Redirecting via `override.url` to a different origin is subject to the same target/policy checks; cross-origin redirects are logged.
- Intercepted headers and bodies frequently carry secrets (auth tokens, cookies). They are never logged; any `route.*` signal evidence is passed through the existing `redactSensitive` path before persistence (framework spec section 14).
- `request-intercept` is a high-power capability: gate community extensions behind the allowlist and surface it prominently in the admin capability list.

## 8. Performance

`context.route` forces every matching request through the Node side, which is measurable on link-heavy pages. Mitigations are first-class, not afterthoughts: handlers declare `routePatterns` / `resourceTypes` so only relevant requests are routed, and when no extension registers an interceptor no route is installed at all (zero overhead, identical to today). Document the cost so authors scope their patterns.

## 9. Authoring example (illustrative, not a shipped recipe)

```ts
register(r: ChallengerRegistrar) {
  // strip a tracking header and block analytics beacons
  r.interceptRequest(
    (ctx) => {
      if (/(analytics|doubleclick|hotjar)/.test(ctx.request.url)) {
        ctx.route.abortRequest('blockedbyclient');
        return;
      }
      ctx.route.modifyRequest({ headers: { 'sec-ch-ua-platform': '"Windows"' } });
    },
    { mode: 'mutating', resourceTypes: ['script', 'image', 'xhr'], priority: 20 },
  );
}
```

## 10. File-by-file change list

New / modified:

- `packages/core/src/extension/challenger-contract.ts` - `request-intercept` capability; `ChallengerRequestInfo`, `ChallengerRequestOverride`, `ChallengerFulfillResponse`, `ChallengerRouteHelpers`, `ChallengerRouteContext`, `ChallengerRouteHandlerOptions`; `interceptRequest` on `ChallengerRegistrar`.
- `packages/browser/src/port/challenger-dispatcher.ts` - `route-request` stage; `RouteDecision`; `routeRequest` / `hasRouteHandlers` on `ChallengerRunSession`; Noop passthrough.
- `packages/challenger/src/worker/challenger-run-session.ts` - route handler collection, arbitration, `route.decided` signal, audit entry.
- `packages/challenger/src/worker/challenger-dispatcher.service.ts` - collect `interceptRequest` registrations; reject `observer` mode.
- `packages/browser/src/challenger-integration.ts` - register `context.route` when `hasRouteHandlers()`; map `RouteDecision` to `Route.continue/abort/fulfill`.
- `packages/browser/src/index.ts` - export new port types.

## 11. Testing

- Arbitration: abort wins over later handlers; fulfill wins; header overrides from multiple handlers merge in priority order; no-handler passthrough returns `continue`; fail-open on throw/timeout.
- Capability gating: a handler whose extension omits `request-intercept` is skipped.
- Pattern/resource filtering: a request outside `routePatterns` / `resourceTypes` is not routed to the handler.
- Browser integration: `context.route` is installed only when route handlers exist; the Noop path installs none; decisions map onto the correct `Route` call.
- Security: secrets in intercepted headers/bodies are redacted in any emitted signal.

## 12. Response interception (`response-intercept`, implemented)

Response-body transformation ships as a sibling capability `response-intercept` with a single registrar entry `interceptResponse(handler, { routePatterns, resourceTypes, ... })`. It reuses this document's routing seam: the same context-level `context.route` that request interception installs.

- **Context**: `ChallengerResponseInterceptContext` exposes a read snapshot `ctx.response` (`url`, `status`, `headers`, `body?`, `resourceType`, `isBinary`) and `ctx.respond.modifyResponse({ status?, headers?, body? })`.
- **Arbitration is an ordered pipeline**, not first-terminal-wins: response handlers run serially in the standard order (handler priority, extension priority, registration order); each sees the previous handler's output (`status`/`headers`/`body` accumulate; headers merge, body replaces). A `route.response-modified` signal is emitted when the response changes.
- **Cost is opt-in**: the browser continues natively (cheap) unless a response handler matches the request. When one does, the handler path does `route.fetch()` (real, proxied egress) → builds the response snapshot → runs the pipeline → `route.fulfill({ response, status?, headers?, body? })`. Text responses (by `content-type`) are decoded to `body`; binary responses set `isBinary` and pass through untouched.
- **Fail-open**: an erroring/timed-out response handler is skipped and the origin response is served unchanged, so a broken transformer never wedges the page.
- Capability gating, secret redaction, and `NetworkPolicy` rules are identical to request interception (sections 3, 6, 7).

## 13. Open questions

- Whether to add incremental (streamed) response transformation, given the current buffered `route.fetch()` + `fulfill()` round-trip cost on large assets.
- Whether `routePatterns` should compile to Playwright URL globs, `RegExp`, or both (mirror the existing `urlPatterns` matcher in targets).
- Whether multiple terminal decisions should hard-error in `fail-run` extensions instead of first-wins, to catch conflicting interceptors during development.
