---
title: Module System
sidebar_position: 2
description: How modules.config.ts and pnpm generate wire a feature into all three applications.
---

# Module System

A **module** is a self-contained package under `packages/<name>` that can contribute API endpoints, worker services, an admin UI, and data entities — declared once and wired everywhere through generated code, never through hand-edited application files.

## The enable list

`modules.config.ts` at the repository root is the single source of truth:

```ts
export const enabledModules: ModuleEntry[] = [
  { id: 'challenger', package: '@tentacrawl/challenger' },
  { id: 'proxy', package: '@tentacrawl/proxy' },
  // ...
];
```

## Generation

`pnpm generate` (`packages/cli/src/generate.ts`) statically parses `modules.config.ts` and each enabled module's `src/index.ts` — it never executes either file — to extract the exported `metadata: ModuleInfo` object, then emits:

- `apps/api/src/generated/modules.ts` and `apps/worker/src/generated/modules.ts` — calls to each module's `forApi()` / `forWorker()`
- `apps/{api,worker}/src/generated/entities.ts` — MikroORM entities collected from each module's `data/entities.ts`
- `apps/web/src/generated/navigation.ts` and `routes.ts` — the admin sidebar and route table, from each module's `ModuleInfo.navigation` / `routes`
- `apps/web/src/generated/page-registry.ts` — a lazy import map from route path to the module's exported frontend page component

A generic catch-all route in `apps/web` resolves any path against this registry, so a new module's pages need no physical file under `apps/web/src/app`. `requires` in `ModuleInfo` declares a hard dependency (`proxy` requires `challenger`); the generator fails the build if a required module is not also enabled, and fails the build — rather than silently skipping — if an enabled module's path does not resolve at all.

These generated files are committed and must never be hand-edited; CI verifies they match `modules.config.ts` on every pull request.

## The layout every module follows

```text
packages/<module>/src/
  index.ts            # exports metadata: ModuleInfo
  <module>.module.ts  # forApi() / forWorker()
  api/                # controllers
  worker/             # queue consumers, services
  data/                # entities.ts, schemas.ts
  frontend/            # pages, components, hooks — exposed via a ./frontend subpath export
```

The full rules — naming, subpath exports, cross-module boundaries — live in `AGENTS.md`, section 11.

## Next steps

- [The Challenger Framework](/architecture/challenger-framework) — the other axis of extensibility: runtime behavior rather than feature composition.
- [Publishing an External Extension](/extending/publishing-an-external-extension) — the current limits of this generator for packages that live outside this repository.
