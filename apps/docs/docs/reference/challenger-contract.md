---
title: Challenger Contract
sidebar_position: 5
description: The ChallengerExtension and ChallengerRegistrar interfaces, in full.
---

# Challenger Contract

Defined in `packages/core/src/extension/challenger-contract.ts`. For the concepts behind these fields, read [Extending Tentacrawl](/extending/overview) first; this page is the exhaustive field list.

## `ChallengerExtension`

| Field | Type | Notes |
| --- | --- | --- |
| `moduleId` | `string` | Owning module |
| `extensionId` | `string` | Unique within the module |
| `version` | `string` | |
| `priority?` | `number` | Default `100`; lower runs earlier |
| `capabilities` | `ChallengerCapability[]` | Declared and, for interception, enforced |
| `targets?` | `ChallengerTarget[]` | Extension-level run filter |
| `configSchema?` | `ZodSchema` | Validated per run; injected as `ctx.config` |
| `selection?` | `ChallengerSelectionDescriptor` | Points the admin UI at an endpoint listing selectable options (e.g. proxy servers) |
| `register?(registrar)` | | Attach granular handlers |
| `beforeRun?/afterRun?(ctx)` | `Promise<void>` | Coarse whole-run hooks |
| `onError?(ctx, error)` | `Promise<void>` | Covers runs that crash before `run-outcome` fires |

## Capabilities

`proxy`, `session`, `fingerprint`, `navigation`, `signal-analysis`, `artifact-analysis`, `user-behavior`, `dsl-action`, `request-intercept`, `response-intercept`.

## `ChallengerRegistrar` methods

| Method | Context type | Stage |
| --- | --- | --- |
| `onBootstrapContext` | `ChallengerBootstrapContext` | Before the browser context is built |
| `onCreatePage` | `ChallengerPageContext` | After `context.newPage()` |
| `beforeNavigation` / `afterNavigation` | `ChallengerNavigationContext` | Around each navigation |
| `beforeStep` / `afterStep` | `ChallengerStepContext` | Around each DSL step |
| `onRequest` / `onResponse` / `onRedirect` | `ChallengerRequestContext` / `ChallengerResponseContext` / `ChallengerRedirectContext` | Observe-only network events |
| `interceptRequest` | `ChallengerRouteContext` | Mutating only; requires `request-intercept` |
| `interceptResponse` | `ChallengerResponseInterceptContext` | Mutating only; requires `response-intercept` |
| `onSessionSnapshot` | `ChallengerSessionContext` | Cookies, storage, headers |
| `onSignal` | `ChallengerSignalContext` | Fan-out from any `emitSignal` call |
| `onArtefactCollected` / `onDiscoveredLink` | `ChallengerArtifactContext` | Can drop a discovered link |
| `onRunOutcome` | `ChallengerRunOutcomeContext` | Final outcome, before `afterRun` |
| `registerAction` | — | `ChallengerActionDefinition`; see [Add a Custom DSL Action](/extending/add-a-dsl-action) |

Every method takes an optional `ChallengerHandlerOptions`: `mode` (`'mutating' | 'observer'`, default `'mutating'`), `priority`, `timeoutMs`, `errorPolicy` (`'warn-and-continue' | 'fail-run' | 'disable-extension-for-run'`, default `'warn-and-continue'`), `targets`. `interceptRequest`/`interceptResponse` additionally accept `routePatterns` and `resourceTypes`.

## `ChallengerHelperApi`

| Method | Effect |
| --- | --- |
| `emitSignal(signal)` | See [Signals and Diagnostics](/architecture/signals-and-diagnostics) |
| `appendArtifact(key, value)` | Namespaced under `challenger.<extensionId>.<key>` |
| `dropDiscoveredLink(reason?)` | Artifact/link stage only |
| `setProxyCandidate(candidate)` | |
| `patchContextOptions(patch)` | Only honored from `onBootstrapContext` / `beforeRun` |
| `setSessionState(patch)` | Cookies, local/session storage, extra headers |
| `requestNavigationOverride(override)` | `'continue' \| 'retry' \| 'abort' \| 'delay'` |
| `setOutcomeOverride(override)` | Sets the final `RunOutcome` and a reason |

## Built-in signal types

`network.blocked`, `network.redirect-loop`, `network.challenge-header`, `session.cookies-changed`, `session.storage-changed`, `page.captcha-suspected`, `page.interstitial-detected`, `page.login-required`, `page.unusual-fingerprint-feedback`, `run.outcome-overridden`, `route.decided`, `route.response-modified`. The type is open (`string & {}`) — an extension can emit its own.
