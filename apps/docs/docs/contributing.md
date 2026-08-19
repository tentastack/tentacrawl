---
title: Contributing
slug: /contributing
description: How to set up, validate, and submit changes to Tentacrawl.
---

# Contributing

Tentacrawl's conventions live in two files at the repository root:

- **[CONTRIBUTING.md](https://github.com/tentastack/tentacrawl/blob/main/CONTRIBUTING.md)** — setup, local validation, commit and pull request conventions, and how releases work.
- **[AGENTS.md](https://github.com/tentastack/tentacrawl/blob/main/AGENTS.md)** — the working conventions for the codebase itself: module layout, naming, type safety, testing, and code style.

Read those two files first.

## The short version

```bash
pnpm install
pnpm exec playwright install chromium
pnpm generate
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Every pull request runs `.github/workflows/ci.yml` (lint, build and test, and a check that generated registries are up to date). Pull requests are squash merged, and the pull request title becomes the commit message and drives the release — see [Conventional Commits](https://www.conventionalcommits.org/) and the commit conventions in CONTRIBUTING.md.

## Where to start

- Adding a new feature module: see [Module System](/architecture/module-system) and the deterministic layout in `AGENTS.md`.
- Adding a Challenger extension: see [Extending Tentacrawl](/extending/overview).
- Improving these docs: pages live under `apps/docs/docs/`; every page has an "Edit this page" link that opens the file directly on GitHub.
