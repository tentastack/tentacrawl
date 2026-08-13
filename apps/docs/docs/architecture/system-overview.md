---
title: System Overview
sidebar_position: 1
description: The three applications, the job flow between them, and the dependency direction that keeps the system extensible.
---

# System Overview

Three applications, one pnpm workspace:

```text
apps/web (Next.js 15 admin UI)
  |
  v
apps/api (NestJS HTTP API) <-----> MongoDB (config, runs, artefact metadata)
  |
  v
BullMQ / Redis (job queue)
  |
  v
apps/worker (NestJS worker: consumes jobs, drives Playwright)
  |
  v
packages/browser + Playwright  -->  target websites  -->  artefacts
```

The API creates jobs and serves configuration and admin endpoints; the worker is the only process that launches a browser. Splitting them means the browser fleet scales independently of request handling, and an API restart never interrupts an in-flight scrape.

## The dependency direction that matters

```text
packages/core        <- everyone imports this (types, schemas, the extension registry)
      ^         ^
packages/browser -- port --> packages/challenger (host) --> browser + core
(never imports the host)      packages/proxy / your extension --> core
```

`packages/browser` defines the `ChallengerDispatcher` interface it calls at each lifecycle point, but never imports the module that implements it. `packages/challenger` provides the real implementation and is wired in by the worker; a `NoopChallengerDispatcher` stands in for the sandbox and unit tests. This is what lets the browser package stay dependency-free — no NestJS, no database — while still being fully extensible. See [The Challenger Framework](/architecture/challenger-framework) for the run lifecycle this enables.

## Next steps

- [Module System](/architecture/module-system) — how a feature becomes a module and gets wired into all three apps.
- [The Challenger Framework](/architecture/challenger-framework) — the extension surface itself.
