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

## Resolving a module's package

For each entry, the generator looks in two places, in order:

1. `packages/<name>` in this workspace (`entry.package` with the `@tentacrawl/` prefix stripped) — a filesystem check.
2. Node module resolution for `entry.package`, tried from the workspace root and then from `apps/api`, `apps/worker`, and `apps/web` — whichever of those has it installed as a dependency. This is how an external module (installed with `pnpm add -w`, from npm, a git URL, or a local `link:`) resolves. It must already be built and have a `dist/`.

Either way, the module's own `src/index.ts` is what gets statically parsed for metadata.

## Outputs (committed, never hand-edited)

- `apps/api/src/generated/modules.ts`
- `apps/api/src/generated/entities.ts`
- `apps/worker/src/generated/modules.ts`
- `apps/worker/src/generated/entities.ts`
- `apps/web/src/generated/navigation.ts`
- `apps/web/src/generated/routes.ts`
- `apps/web/src/generated/page-registry.ts`
- `apps/web/src/generated/transpile-packages.ts`

## Failure modes

The generator exits non-zero — it does not warn and continue — when:

- A module's package can't be resolved at all (not in `packages/`, not installed anywhere the generator looks).
- A module resolves but has no valid `metadata` export in `src/index.ts`.
- A module's `requires` lists a dependency that is not also enabled in `modules.config.ts`.

CI runs `pnpm generate` on every pull request and fails if the result differs from what's committed, so a stale registry can't merge.

## Run it

```bash
pnpm generate
```

Run it after any change to `modules.config.ts` or to a module's `metadata`.
