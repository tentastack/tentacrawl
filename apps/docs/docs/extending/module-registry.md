---
title: Module Registry
sidebar_position: 6
description: Official and team-verified Tentacrawl modules, and what those labels mean.
---

# Module Registry

A module — official, verified, or neither — is code that runs inside your worker and API processes with the same access as the platform itself: it sees page content, credentials passed through `ChallengerRuntimeContext`, and anything else a run touches. For anything outside the two reviewed tiers below, read the source before installing.

## Trust tiers

| Tier | Meaning | Who maintains it |
| --- | --- | --- |
| **Official** | Built and maintained by the Tentacrawl team. Same review bar as this repository. | [`tentastack/tentacrawl-modules`](https://github.com/tentastack/tentacrawl-modules) |
| **Verified** | Built by someone outside the team, reviewed once against the checklist below, and re-reviewed on request when it changes meaningfully. Verification is a point-in-time code review, not ongoing maintenance — the team does not own or patch a verified module. | The original author, in their own repository |
| **Community** | Everything else on npm, GitHub, or anywhere else that implements the module contract. Not reviewed by the Tentacrawl team. Works the same technically; carries none of the above. | The author |

None of this is enforced by the platform: `pnpm generate` resolves and wires in any package that matches the module contract, regardless of tier.

## Official modules

| Module | Package | Purpose |
| --- | --- | --- |
| `proxy` | [`@tentacrawl/proxy`](https://github.com/tentastack/tentacrawl-modules/tree/main/packages/proxy) | Manually defined proxy servers with shared credentials, endpoint rotation, and usage tracking. The reference [Challenger extension](/extending/overview). |

```bash
pnpm add -w @tentacrawl/proxy
```

See [Configure a Proxy](/guides/configure-a-proxy) and [Publishing an External Extension](/extending/publishing-an-external-extension) for installation mechanics.

## Verified modules

None yet. The first community module to pass review lands here.

## Getting a module verified

Open an issue on [`tentastack/tentacrawl`](https://github.com/tentastack/tentacrawl/issues) with a link to the module's repository. The team checks it against:

- **Does what it claims.** The module's `ModuleInfo.description` and its actual `ChallengerCapability` list and handlers match — no capability declared that isn't used, no behavior that isn't declared.
- **No obvious harm.** No exfiltration of page content, credentials, or `ChallengerRuntimeContext` data to an undisclosed destination; no obfuscated or minified-only source (the module must ship `src/`, per the [module contract](/extending/publishing-an-external-extension) — this is also what makes review possible in the first place).
- **Follows the contract.** Ships both `dist/` and `src/`, declares host packages as peer dependencies rather than bundling them, exports a valid `metadata: ModuleInfo`, and otherwise matches the layout in [Module System](/architecture/module-system).
- **Reasonable dependency footprint.** No unpinned or obviously unmaintained transitive dependencies pulled in for something the module doesn't need.
- **A named maintainer.** Someone accountable for the repository — a person or org, not an anonymous npm publish.

This is a one-time code review, not a security audit and not an ongoing commitment — a verified module can still ship a bug or a bad update later. Significant changes to a verified module (a new capability, a new external network call, a maintainer change) are grounds for re-review; the team may pull the "verified" label if a module stops meeting the bar.

## Using a community (unverified) module

Nothing stops you — `pnpm add -w` and `modules.config.ts` work the same regardless of tier. Before you do:

- Read the source. It's TypeScript, and the module contract requires it be shipped, not just compiled output.
- Check what `ChallengerCapability` values it declares and whether they match what it should need.
- Pin an exact version rather than a caret range, and review diffs on upgrade.
- Prefer a module that's itself open source with visible history over one distributed as a bare npm package.
