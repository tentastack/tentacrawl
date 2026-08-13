---
title: Overview
sidebar_position: 1
description: The Challenger contract, in the concepts that matter most when writing one.
---

# Extending Tentacrawl

The **Challenger framework** is the only supported way to change scrape and crawl behavior. A challenger is a module that implements `ChallengerExtension` from `@tentacrawl/core`, self-registers on `OnModuleInit`, and attaches handlers to the stages of a run it cares about — navigation, requests and responses, session state, DSL steps, artifacts, discovered links. `packages/proxy` is the reference implementation; read `packages/proxy/src/worker/proxy.challenger.ts` alongside this page.

## Identity

```ts
readonly moduleId: string;      // the owning module, e.g. 'proxy'
readonly extensionId: string;   // unique within the module, e.g. 'manual'
```

The fully-qualified key is `${moduleId}/${extensionId}` and must be globally unique. Two fields, not one, because a single module can ship several extensions (a captcha module offering both `twocaptcha` and `capsolver`, say) — the registry, admin UI, and artifact namespacing all key off this pair.

## Capabilities and targets

`capabilities: ChallengerCapability[]` is a declared list (`proxy`, `session`, `fingerprint`, `navigation`, `signal-analysis`, `artifact-analysis`, `user-behavior`, `dsl-action`, `request-intercept`, `response-intercept`). It drives the admin UI and an operator-configurable allowlist; for the two interception capabilities it is also enforced — handlers registered without the matching capability are dropped at collection time.

`targets` (hostnames, origins, URL patterns, task types) narrow *when* handlers run. Settable at the extension level and per handler; both must match.

## Configuration

Declare a `configSchema` (a Zod schema); the host stores opaque JSON per extension and validates it before every run, injecting the result as `ctx.config`. You own your own settings UI — there is no generic config editor. Invalid stored config falls back to schema defaults rather than failing the run.

## State isolation

`ctx.state` is a `Map` scoped to your extension for the current run only. You cannot read another extension's state; the only sanctioned cross-extension channel is signals.

## Helpers vs. raw

Anything that touches *shared* run state — proxy selection, outcome, navigation decisions, context options, session, artifacts, signals — goes through `ctx.helpers`, so the host can order, validate, and audit it deterministically. Self-contained Playwright work (clicking, typing, reading the page) happens directly on `ctx.raw.page`, cast through the typed helpers exported from `@tentacrawl/challenger` (`asPage(ctx)`, `asContext(ctx)`, `asRequest(ctx)`, `asResponse(ctx)`).

## Modes, timeouts, error policy

A handler is `mode: 'mutating'` (serial, priority-ordered, can mutate) or `mode: 'observer'` (concurrent, cannot mutate). `timeoutMs` wraps every invocation. `errorPolicy` is `warn-and-continue` (default), `fail-run`, or `disable-extension-for-run` — this bounds how much damage a broken or slow extension can do to a single run.

## Signals

The diagnostic and cross-extension communication bus. Emit one with `ctx.helpers.emitSignal(...)`; it fans out to other extensions' `onSignal` handlers in-run and is persisted (with automatic redaction of anything that looks like a secret) for the Extensions admin dashboard. See [Signals and Diagnostics](/architecture/signals-and-diagnostics).

## Next steps

- [Build a Challenger Extension](/extending/build-a-challenger-extension) — a full walkthrough building a captcha-solving extension.
- [Intercepting Requests and Responses](/extending/intercepting-requests-and-responses) — rewrite, block, or fulfill traffic.
- [Add a Custom DSL Action](/extending/add-a-dsl-action) — make your extension's logic callable from YAML.
