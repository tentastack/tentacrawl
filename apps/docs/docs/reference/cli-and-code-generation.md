---
title: CLI and Code Generation
sidebar_position: 4
description: What pnpm generate does, what it produces, and how it fails.
---

# CLI and Code Generation

`pnpm generate` runs `packages/cli/src/generate.ts` against `modules.config.ts`. See [Module System](/architecture/module-system) for the full mechanics; this page is the quick-reference version.

## Inputs

- `modules.config.ts` — the enabled module list, `{ id, package }[]`.
- Each enabled module's `src/index.ts` — must export `metadata: ModuleInfo`, parsed statically (never executed).

## Outputs (committed, never hand-edited)

- `apps/api/src/generated/modules.ts`
- `apps/api/src/generated/entities.ts`
- `apps/worker/src/generated/modules.ts`
- `apps/worker/src/generated/entities.ts`
- `apps/web/src/generated/navigation.ts`
- `apps/web/src/generated/routes.ts`
- `apps/web/src/generated/page-registry.ts`

## Failure modes

The generator exits non-zero — it does not warn and continue — when:

- A module's `src` directory does not resolve on disk.
- A module has no valid `metadata` export.
- A module's `requires` lists a dependency that is not also enabled in `modules.config.ts`.

It also warns (without failing) when a module's `package.json` version and its `ModuleInfo.version` disagree, since the two are hand-maintained independently.

CI runs `pnpm generate` on every pull request and fails if the result differs from what's committed, so a stale registry can't merge.

## Run it

```bash
pnpm generate
```

Run it after any change to `modules.config.ts` or to a module's `metadata`.
