---
title: The Challenger Framework
sidebar_position: 3
description: The run lifecycle and where each extension stage fires, end to end.
---

# The Challenger Framework

Every scrape and crawl-page run is driven through the same dispatch sequence, whether or not any extension is listening.

```text
dispatcher.beginRun(seed)  ->  ChallengerRunSession
   |
createHardenedContext(opts, session)
   -> dispatch('bootstrap-context')     <- proxy / fingerprint / launchArgs decided here
   |
context.newPage() -> instrumentPage(page, session)
   -> dispatch('create-page')
   -> page.on('request'|'response') -> dispatch('request'|'response'|'redirect')
   -> if any interception handlers exist: context.route('**/*', ...)
   |
runDsl / simple scrape
   -> dispatch('before-navigation') / ('after-navigation')   <- retry/abort/delay honored here
   -> per step: dispatch('before-step') / ('after-step')
   -> unknown action? session.resolveAction(name) -> runAction()
   |
collectArtefacts -> dispatch('artefact-collected')
discoverLinks    -> dispatch('discovered-link')              <- links can be dropped here
   |
finalizeRun: dispatch('run-outcome') -> session.end(outcome)
   -> extension.afterRun() / onError()
```

Listeners are attached only when a handler actually exists for that stage (`session.hasHandlers(...)`).

## Ordering and isolation

Extensions and handlers both carry a `priority` (lower runs first, default 100). Within a stage, `mutating` handlers run serially in priority order; `observer` handlers run concurrently afterward and cannot affect run state. Each extension sees only its own `ctx.state` — the only sanctioned way for one extension to learn about another's activity is a signal (see [Signals and Diagnostics](/architecture/signals-and-diagnostics)).

## Request and response interception

Both flow through one `context.route` seam, installed at most once per page. Request interception is first-terminal-wins; response interception is an ordered pipeline where each handler sees the previous one's output. Both fail open on a handler exception or an upstream fetch failure — see [Intercepting Requests and Responses](/extending/intercepting-requests-and-responses).

## Browser pooling and fingerprint isolation

See [Browser Execution and Pooling](/architecture/browser-execution) for how the same lifecycle reconciles sharing one browser process across runs with letting an extension request a genuinely distinct one.

## Config, lifecycle, and the admin surface

Extension configuration, the enable/disable toggle, and the archive-then-purge removal lifecycle are covered in the [Manage Extensions guide](/guides/manage-extensions) — this page is about what happens *during* a run; that one is about operating extensions *between* runs.
