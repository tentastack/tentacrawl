---
title: Publishing an External Extension
sidebar_position: 5
description: What works today for a challenger that lives outside this repository, and what does not yet.
---

# Publishing an External Extension

The `ChallengerExtension` contract itself has no dependency on this repository — it imports only types from `@tentacrawl/core`, and an extension self-registers through ordinary NestJS dependency injection. A correctly implemented extension runs regardless of where its source lives.

**The module-wiring generator does not yet resolve packages outside this workspace.** `pnpm generate` reads each `modules.config.ts` entry and looks for its module metadata at `packages/<name>/src/index.ts` inside this repository. A package installed from npm — `@yourorg/tentacrawl-captcha` from `node_modules` — resolves to a path that does not exist and is skipped, currently with a hard failure (see [Reference: CLI and Code Generation](/reference/cli-and-code-generation)) rather than a silently incomplete build.

## What works today

Add the extension's source under `packages/<name>` in this workspace — as a git submodule, a subtree, or a plain copy — so pnpm workspace-links it like any in-tree module, then add it to `modules.config.ts` as usual. This is the same mechanism `proxy` and every other in-tree module use; there is nothing second-class about it.

## What this means in practice

- Fine for a private or internal extension you control.
- Fine for iterating on a community extension before it graduates to independent maintenance.
- Not yet a `pnpm add @someone/tentacrawl-captcha` experience for a published, independently versioned package.

Closing this gap means teaching the generator to resolve a package through normal Node module resolution (falling back to the in-repo path), reading its metadata from a build-time manifest instead of parsing `src/index.ts` (so a published `dist/`-only package works), and generating `apps/web`'s `transpilePackages` list instead of hand-maintaining it. None of that is implemented yet. If you hit this boundary, treat it as a known gap, not a bug in your extension.
