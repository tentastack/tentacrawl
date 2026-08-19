---
title: Signals and Diagnostics
sidebar_position: 5
description: The diagnostic bus that makes a blocked or failed run debuggable, and how swallowed failures get surfaced.
---

# Signals and Diagnostics

Extension state is isolated per extension (see [the overview](/extending/overview)). **Signals** are how an extension communicates with other extensions and with an operator.

## What a signal is

```ts
ctx.helpers.emitSignal({
  signalType: 'page.captcha-suspected', // built-in types are open: (string & {}) too
  severity: 'warn',                     // 'info' | 'warn' | 'error'
  annotations: { url: page.url() },
});
```

## Where it goes

1. **Other extensions, in-run.** Fans out synchronously to every `onSignal` handler, depth-capped at 3.
2. **The Extensions admin dashboard.** Batched and persisted (default: every second or every 100 signals, whichever comes first) with automatic redaction of any field whose key looks like a secret (`password`, `token`, `cookie`, `authorization`, `credential`, `proxy`, and similar). Visible per-extension and per-run in the [Manage Extensions](/guides/manage-extensions) detail view.
3. **The activity log**, but only for `severity: 'error'`.
4. **The framework's own audit trail.** `route.decided`, `route.response-modified`, `run.outcome-overridden`, `challenger.handler-error`, and `challenger.config-invalid` are emitted automatically.

A run's signal history reads in order, for example `network.challenge-header` → `page.captcha-suspected` → `proxy.endpoint-failed`.

## Diagnostics: the layer below signals

`packages/browser` reports lower-level plumbing failures (a `route.fetch` that failed because a proxy died, a handler dispatch that threw) through an optional `session.diagnostic(scope, message, error)` call, implemented by the host against its structured logger and correlated by task id. If you are debugging a run that behaved oddly with no corresponding signal, worker logs are the next place to look.
