---
title: Signals and Diagnostics
sidebar_position: 5
description: The diagnostic bus that makes a blocked or failed run debuggable, and how swallowed failures get surfaced.
---

# Signals and Diagnostics

Extension state is hard-isolated by design — see [the overview](/extending/overview) — which means extensions need a sanctioned way to talk to each other and to an operator. **Signals** are that channel.

## What a signal is

```ts
ctx.helpers.emitSignal({
  signalType: 'page.captcha-suspected', // built-in types are open: (string & {}) too
  severity: 'warn',                     // 'info' | 'warn' | 'error'
  annotations: { url: page.url() },
});
```

## Where it goes

1. **Other extensions, in-run.** Fans out synchronously to every `onSignal` handler, depth-capped at 3 so a signal storm can't wedge a run.
2. **The Extensions admin dashboard.** Batched and persisted (default: every second or every 100 signals, whichever comes first) with automatic redaction of any field whose key looks like a secret (`password`, `token`, `cookie`, `authorization`, `credential`, `proxy`, and similar). Visible per-extension and per-run in the [Manage Extensions](/guides/manage-extensions) detail view.
3. **The activity log**, but only for `severity: 'error'` — this is the operator-visible escalation path, opt-in by severity rather than by every emission.
4. **The framework's own audit trail.** `route.decided`, `route.response-modified`, `run.outcome-overridden`, `challenger.handler-error`, and `challenger.config-invalid` are emitted automatically, so a run's signal history reads as a story even if every extension involved only ever observes.

A run that comes back `BLOCKED` with no signals is a mystery. A run with `network.challenge-header` → `page.captcha-suspected` → `proxy.endpoint-failed` tells you what happened, in order, without reading a log file.

## Diagnostics: the layer below signals

Signals are a domain concept — they mean something to an extension author. Underneath them, `packages/browser` also reports lower-level plumbing failures (a `route.fetch` that failed because a proxy died, a handler dispatch that threw) through an optional `session.diagnostic(scope, message, error)` call, implemented by the host against its structured logger and correlated by task id. This exists specifically so a failure that is caught and handled gracefully — the framework fails open by design — is not also a failure nobody can see. If you are debugging a run that behaved oddly with no corresponding signal, worker logs are the next place to look.
