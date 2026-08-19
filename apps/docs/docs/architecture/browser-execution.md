---
title: Browser Execution and Pooling
sidebar_position: 4
description: How Tentacrawl balances memory cost against fingerprint isolation across concurrent runs.
---

# Browser Execution and Pooling

`packages/browser` keeps a process-level pool of Chromium browsers, keyed by **launch profile** — the sorted launch args, `headless`, `channel`, `executablePath`, and any launch-level proxy server, hashed together. `getOrCreateBrowser(launchOptions)` returns the pooled browser for that exact profile, launching a new one only when no match exists.

The pool balances two things:

- **Memory conservation, by default.** Most runs share one browser process and each gets a fresh, isolated `BrowserContext` — separate cookies, storage, cache, proxy, user agent, viewport, locale, and timezone.
- **Process-level fingerprint isolation, on demand.** Some signals are fixed for an entire Chromium process — launch flags, the TLS/JA3 stack, GPU/WebGL, HTTP/2 framing — and cannot differ between two contexts of the *same* browser. A [Challenger extension](/extending/overview) that needs traffic to look like a genuinely different machine sets distinct `launchArgs` (and optionally a launch-level proxy) via `ctx.helpers.patchContextOptions(...)` during `bootstrap-context`; the pool then hands that run its own browser process. Identical profiles keep sharing one process; distinct ones don't.

`launchArgs` from an extension are always merged on top of the hardening defaults, never replace them.

## Pool bounds

The pool is bounded by `BROWSER_POOL_MAX` (default `4`) and evicts the least-recently-used browser that currently has no open contexts when the bound is reached — an active run is never torn down out from under it.

## Next steps

- [The Challenger Framework](/architecture/challenger-framework) for where `bootstrap-context` sits in the overall run lifecycle.
- [Environment Variables reference](/reference/environment-variables) for `BROWSER_POOL_MAX` and related tuning.
