---
title: Publishing an External Extension
sidebar_position: 5
description: How an extension that lives outside the main repository gets packaged, installed, and wired in.
---

# Publishing an External Extension

Challenger extensions — proxy providers, captcha solvers, fingerprint rotators, login flows — live outside the main repository as ordinary packages that a deployment installs on demand.

`pnpm generate` resolves a module the same way whether it's workspace-linked under `packages/<name>` in the main repository or installed into `node_modules` from npm, a git URL, or a local path. `@tentacrawl/proxy`, the reference Challenger extension, is an external module.

## What a module package must ship

- **`dist/`** — compiled JavaScript, what the host `require()`s at runtime.
- **`src/`** — the raw TypeScript source. `pnpm generate` parses `src/index.ts` statically (never executes it) to read `metadata: ModuleInfo`, and any frontend surface is transpiled from source by Next.js rather than pre-compiled, since the `./frontend` subpath export points at `src/frontend/`, not `dist/`.
- Both listed in the package's `files` field.

## Dependencies: host packages are peers

Everything the host provides is a `peerDependency`, never a `dependency`:

```json
{
  "peerDependencies": {
    "@tentacrawl/core": "*",
    "@nestjs/common": "^11.0.0",
    "@mikro-orm/core": "^6.5.0",
    "react": "^19.0.0"
  }
}
```

This is a correctness requirement, not a packaging preference. A module that declares `@tentacrawl/core` as a regular dependency gets its **own copy** under pnpm's isolated layout — which means a second `ChallengerRegistry` class identity, and Nest's DI silently failing to inject the host's registry. The same reasoning already applies to `@nestjs/*` and `@mikro-orm/*`.

Two further rules:

- Never use `workspace:*` for a host package. That protocol only resolves inside the main repository's own workspace.
- Match the versions the host actually installs. A peer range of `lucide-react: ^0.500.0` against a host on `0.468.0` is an unmet peer.

Mark a peer `optional` in `peerDependenciesMeta` only if your module genuinely works without it — a frontend-shipping module really does need `react` and `@tentacrawl/ui`.

## Installing one

```bash
pnpm add -w @tentacrawl/proxy
```

The `-w` is required. The module is installed once at the workspace root, and `.pnpmfile.cjs` propagates that spec into `apps/api`, `apps/worker`, and `apps/web`, where each app's copy resolves the module's peer dependencies.

Then enable it and regenerate:

```ts
// modules.config.ts
export const enabledModules: ModuleEntry[] = [
  // ...
  { id: 'proxy', package: '@tentacrawl/proxy' },
];
```

```bash
pnpm generate
```

## Current limitation: the host packages are unpublished

`@tentacrawl/core` and `@tentacrawl/ui` are private workspace packages today — they carry no `version` field and are not on npm. A third-party extension can declare them as peers (`"*"` is the honest range while they are unversioned) and the host satisfies them from its own workspace, which works. But an extension that lists `@tentacrawl/core` as a regular **dependency** cannot install at all, because there is nothing on the registry to resolve.

Practically: installing an extension from a **local path or git URL into a Tentacrawl checkout works today**. A fully independent `pnpm add -w @some/extension` from npm additionally requires `@tentacrawl/core` (and `@tentacrawl/ui` for frontend surfaces) to be published. Until then, expect `unmet peer ... found undefined` warnings from pnpm — the workspace package satisfies the import, it just has no version string to check against.

## Failure modes

See [Reference: CLI and Code Generation](/reference/cli-and-code-generation) for exactly how `pnpm generate` fails when a module can't be resolved or has no valid metadata.
