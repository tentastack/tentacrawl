---
title: Module System
sidebar_position: 2
description: How modules.config.ts and pnpm generate wire a feature into all three applications.
---

# Module System

A **module** is a self-contained package that can contribute API endpoints, worker services, an admin UI, and data entities — declared once and wired everywhere through generated code, never through hand-edited application files. It can live in this workspace under `packages/<name>`, or be an ordinary installed dependency from outside it; `pnpm generate` resolves both the same way.

There are two kinds:

- **Core modules** extend the platform itself and live in the main repository under `packages/` — `admin`, `challenger`, `crawler`, `notification`, `scraper` today, alongside the foundational packages (`core`, `browser`, `ui`, `dsl`, `cli`) every module builds on. New ones can be added there.
- **Challenger extensions** adapt a run to a specific site or vendor — proxy providers, captcha solvers, fingerprint rotators, login flows. These are external packages installed on demand. `@tentacrawl/proxy` is the reference implementation, maintained in [`tentastack/tentacrawl-modules`](https://github.com/tentastack/tentacrawl-modules); see the [Module Registry](/extending/module-registry) for the full list.

Both use the identical contract and the identical `modules.config.ts` mechanism described below.

## The enable list

`modules.config.ts` at the repository root is the single source of truth:

```ts
export const enabledModules: ModuleEntry[] = [
  { id: 'challenger', package: '@tentacrawl/challenger' },
  { id: 'proxy', package: '@tentacrawl/proxy' }, // pnpm add -w @tentacrawl/proxy first
  // ...
];
```

## Generation

`pnpm generate` (`packages/cli/src/generate.ts`) statically parses `modules.config.ts` and each enabled module's `src/index.ts` — it never executes either file — to extract the exported `metadata: ModuleInfo` object, then emits:

- `apps/api/src/generated/modules.ts` and `apps/worker/src/generated/modules.ts` — calls to each module's `forApi()` / `forWorker()`
- `apps/{api,worker}/src/generated/entities.ts` — MikroORM entities collected from each module's `data/entities.ts`
- `apps/web/src/generated/navigation.ts` and `routes.ts` — the admin sidebar and route table, from each module's `ModuleInfo.navigation` / `routes`
- `apps/web/src/generated/page-registry.ts` — a lazy import map from route path to the module's exported frontend page component
- `apps/web/src/generated/transpile-packages.ts` — the list of module packages Next.js must transpile, since every module frontend ships as raw source (`imported by next.config.ts`)

A generic catch-all route in `apps/web` resolves any path against the page registry, so a new module's pages need no physical file under `apps/web/src/app`. `requires` in `ModuleInfo` declares a hard dependency (`proxy` requires `challenger`); the generator fails the build if a required module is not also enabled.

To find a module's package, the generator first checks `packages/<name>` in this workspace. If that doesn't exist, it resolves the package through Node's module resolution instead, trying the workspace root and each of `apps/api`, `apps/worker`, and `apps/web` in turn — wherever it was installed as a dependency. Either way, the generator fails the build if an enabled module's package can't be resolved at all, or resolves but has no valid `metadata` export.

These generated files are committed and must never be hand-edited; CI verifies they match `modules.config.ts` on every pull request.

## The layout every module follows

```text
<module>/src/
  index.ts            # exports metadata: ModuleInfo
  <module>.module.ts  # forApi() / forWorker()
  api/                # controllers
  worker/             # queue consumers, services
  data/                # entities.ts, schemas.ts
  frontend/            # pages, components, hooks — exposed via a ./frontend subpath export
```

A published module package ships both `dist/` (compiled, for `require()` at runtime) and `src/` (raw TypeScript, for the static metadata parse above and for Next.js to transpile the frontend surface). The full rules — naming, subpath exports, cross-module boundaries — live in `AGENTS.md`, section 11.

## Next steps

- [The Challenger Framework](/architecture/challenger-framework) — the other axis of extensibility: runtime behavior rather than feature composition.
- [Publishing an External Extension](/extending/publishing-an-external-extension) — installing and wiring in a module that lives outside this repository.
- [Module Registry](/extending/module-registry) — official and team-verified modules.
